import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { tables } from "@kwota/db";
import { capOutputTokens, estimateInputTokens, usageCostMicro, type ModelPrice } from "@kwota/core";
import type { Ctx } from "../context";
import { enforceRateLimit, resolvePrincipal, type Principal } from "./principal";
import { HttpError, badRequest, paymentRequired } from "../lib/errors";
import { ProviderError, type ChatMessage, type ProviderChatRequest, type Usage } from "../providers";

const chatSchema = z
  .object({
    model: z.string().min(1).max(200),
    messages: z
      .array(z.object({ role: z.enum(["system", "user", "assistant", "tool", "developer"]), content: z.any() }).passthrough())
      .min(1)
      .max(256),
    max_tokens: z.number().int().positive().optional(),
    max_completion_tokens: z.number().int().positive().optional(),
    stream: z.boolean().optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    stop: z.union([z.string(), z.array(z.string()).max(4)]).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    seed: z.number().int().optional(),
    user: z.string().max(256).optional(),
    response_format: z.any().optional(),
    tools: z.array(z.any()).max(64).optional(),
    tool_choice: z.any().optional(),
  })
  .strict();

function openAiError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ error: { message, type: code, code } });
}

export function priceOf(m: typeof tables.models.$inferSelect): ModelPrice {
  return { inputPriceMicroPerMTok: m.inputPriceMicroPerMTok, outputPriceMicroPerMTok: m.outputPriceMicroPerMTok, markupBps: m.markupBps };
}

export async function gatewayRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/v1/models", async () => {
    const rows = await ctx.db.select().from(tables.models).where(eq(tables.models.enabled, true)).orderBy(asc(tables.models.sortOrder));
    return {
      object: "list",
      data: rows.map((m) => ({
        id: m.id,
        object: "model",
        created: 0,
        owned_by: "kwota",
        name: m.displayName,
        context_length: m.contextLength,
        pricing: {
          kwota_per_mtok_input: Number(m.inputPriceMicroPerMTok) * (1 + m.markupBps / 10_000) / 1e6,
          kwota_per_mtok_output: Number(m.outputPriceMicroPerMTok) * (1 + m.markupBps / 10_000) / 1e6,
        },
      })),
    };
  });

  app.post("/v1/chat/completions", async (req, reply) => {
    try {
      return await handleChat(ctx, req, reply);
    } catch (e) {
      if (e instanceof HttpError) return openAiError(reply, e.status, e.code, e.message);
      if (e instanceof z.ZodError) return openAiError(reply, 400, "invalid_request", e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      req.log.error(e);
      return openAiError(reply, 500, "internal_error", "internal error");
    }
  });
}

async function handleChat(ctx: Ctx, req: FastifyRequest, reply: FastifyReply) {
  const rawBody = (req as FastifyRequest & { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
  const principal = await resolvePrincipal(ctx, req, rawBody);
  await enforceRateLimit(ctx, principal);
  const body = chatSchema.parse(req.body);

  const [model] = await ctx.db.select().from(tables.models).where(eq(tables.models.id, body.model));
  if (!model || !model.enabled) throw new HttpError(404, "model_not_found", `model '${body.model}' is not available`);
  const provider = ctx.providers.get(model.provider);
  if (!provider) throw new HttpError(503, "provider_unavailable", "provider not configured");

  const p = await ctx.params.all();
  const price = priceOf(model);
  const estIn = estimateInputTokens(body.messages as { role: string; content: unknown }[]);
  const maxOut = capOutputTokens({
    requested: body.max_completion_tokens ?? body.max_tokens ?? null,
    serverMax: p.max_output_tokens,
    contextLength: model.contextLength,
    price,
    estimatedInputTokens: estIn,
    maxCostMicro: principal.maxCostMicro,
  });
  if (maxOut < 1) throw badRequest("request exceeds the maximum cost per request", "max_cost_exceeded");
  const reserve = usageCostMicro(price, estIn, maxOut);

  // Agent daily limit
  let day: string | null = null;
  if (principal.agent) {
    day = await ctx.agents.reserveDaily(principal.agent.id, reserve, principal.agent.dailyLimitMicro);
    if (!day) throw new HttpError(429, "daily_limit_exceeded", "agent daily kwota limit reached");
  }
  const ok = await ctx.ledger.reserve(principal.accountId, reserve);
  if (!ok) {
    if (day) await ctx.agents.settleDaily(principal.agent!.id, day, reserve, 0n);
    throw paymentRequired("insufficient kwota balance for this request");
  }

  const [usage] = await ctx.db
    .insert(tables.usageRequests)
    .values({
      accountId: principal.accountId, userId: principal.userId, apiKeyId: principal.apiKeyId, agentId: principal.agent?.id ?? null,
      modelId: model.id, status: "reserved", stream: !!body.stream, reservedMicro: reserve, authMethod: principal.authMethod, nonce: principal.nonce,
    })
    .returning();
  const usageId = usage!.id;
  const started = Date.now();

  const { model: _m, stream: _s, max_tokens: _mt, max_completion_tokens: _mct, ...rest } = body;
  const preq: ProviderChatRequest = { ...rest, model: model.providerModelId, messages: body.messages as ChatMessage[], max_tokens: maxOut };

  const settle = async (u: Usage, providerRequestId?: string) => {
    const cost = usageCostMicro(price, u.prompt_tokens, u.completion_tokens);
    const charged = await ctx.db.transaction(async (tx) => {
      const c = await ctx.ledger.settleIn(tx, { accountId: principal.accountId, reservedMicro: reserve, costMicro: cost, usageId, actor: actorOf(principal) });
      await tx
        .update(tables.usageRequests)
        .set({ status: "settled", inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens, costMicro: c, providerRequestId, latencyMs: Date.now() - started, settledAt: new Date() })
        .where(eq(tables.usageRequests.id, usageId));
      return c;
    });
    if (day) await ctx.agents.settleDaily(principal.agent!.id, day, reserve, charged);
    return charged;
  };
  const fail = async (code: string) => {
    await ctx.ledger.release(principal.accountId, reserve);
    await ctx.db.update(tables.usageRequests).set({ status: "failed", errorCode: code, latencyMs: Date.now() - started, settledAt: new Date() }).where(eq(tables.usageRequests.id, usageId));
    if (day) await ctx.agents.settleDaily(principal.agent!.id, day, reserve, 0n);
  };

  const controller = new AbortController();

  if (!body.stream) {
    let result;
    try {
      result = await provider.chat(preq, controller.signal);
    } catch (e) {
      await fail(e instanceof ProviderError ? `provider_${e.status}` : "provider_error");
      throw new HttpError(502, "provider_error", "upstream model provider error");
    }
    const charged = await settle(result.usage, result.providerRequestId);
    const acc = await ctx.ledger.balance(principal.accountId);
    reply.header("x-kwota-cost-micro", charged.toString());
    reply.header("x-kwota-balance-micro", (acc!.balanceMicro - acc!.reservedMicro).toString());
    return { ...result.body, model: model.id, kwota: { request_id: usageId.toString(), cost_micro: charged.toString() } };
  }

  // ── streaming (SSE)
  let stream;
  try {
    stream = await provider.chatStream(preq, controller.signal);
  } catch (e) {
    await fail(e instanceof ProviderError ? `provider_${e.status}` : "provider_error");
    throw new HttpError(502, "provider_error", "upstream model provider error");
  }
  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "access-control-allow-origin": (req.headers.origin as string) ?? "*",
    "x-kwota-request-id": usageId.toString(),
  });
  let clientGone = false;
  req.raw.on("close", () => {
    if (!raw.writableEnded) {
      clientGone = true;
      controller.abort();
    }
  });
  try {
    for await (const chunk of stream.chunks) {
      if (clientGone) break;
      raw.write(`data: ${JSON.stringify({ ...chunk.data, model: model.id })}\n\n`);
    }
  } catch {
    /* upstream interrupted: bill what was produced */
  }
  // bill tokens actually produced (provider-reported, else estimated from streamed text)
  const charged = await settle(stream.usage(), stream.providerRequestId);
  if (!clientGone) {
    // SSE comment line: ignored by OpenAI-compatible parsers, readable by KWOTA clients
    raw.write(`: kwota ${JSON.stringify({ request_id: usageId.toString(), cost_micro: charged.toString(), usage: stream.usage() })}\n\n`);
    raw.write("data: [DONE]\n\n");
    raw.end();
  }
}

function actorOf(p: Principal) {
  return p.agent ? `agent:${p.agent.id}` : `wallet:${p.userAddress}`;
}

/** Release reservations older than `maxAgeSec` that never settled (crash safety). */
export async function releaseStaleReservations(ctx: Ctx, maxAgeSec = 900) {
  const stale = await ctx.db
    .select()
    .from(tables.usageRequests)
    .where(sql`${tables.usageRequests.status} = 'reserved' and ${tables.usageRequests.createdAt} < now() - (${maxAgeSec} || ' seconds')::interval`);
  for (const u of stale) {
    await ctx.db.transaction(async (tx) => {
      const upd = await tx
        .update(tables.usageRequests)
        .set({ status: "released", errorCode: "stale_reservation", settledAt: new Date() })
        .where(sql`${tables.usageRequests.id} = ${u.id} and ${tables.usageRequests.status} = 'reserved'`)
        .returning();
      if (upd.length) await ctx.ledger.release(u.accountId, u.reservedMicro, tx);
    });
  }
  return stale.length;
}
