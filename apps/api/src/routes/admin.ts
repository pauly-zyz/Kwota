import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { tables } from "@kwota/db";
import type { Ctx } from "../context";
import { audit, requireAdminSession, verifyAdminAction } from "../admin/auth";
import { verifyAndRecordSwap } from "../admin/swaps";
import { DEFAULT_PARAMS, paramSchemas, type Params } from "../params";
import { EpochEngine } from "../epoch/engine";
import { badRequest, notFound } from "../lib/errors";
import { toJson } from "../lib/json";
import { parseKwota } from "@kwota/core";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((s) => s.toLowerCase());

export async function adminRoutes(app: FastifyInstance, ctx: Ctx) {
  const engine = new EpochEngine(ctx);

  app.get("/admin/state", async (req) => {
    await requireAdminSession(ctx, req);
    const [params, exclusions, auditRows, epochs, inflows, models, registries, swaps, topups] = await Promise.all([
      ctx.params.all(),
      ctx.db.select().from(tables.excludedAddresses).orderBy(desc(tables.excludedAddresses.createdAt)),
      ctx.db.select().from(tables.auditLog).orderBy(desc(tables.auditLog.id)).limit(100),
      ctx.db.select({ id: tables.epochs.id, status: tables.epochs.status, startTime: tables.epochs.startTime, endTime: tables.epochs.endTime, budgetMicro: tables.epochs.budgetMicro, distributedMicro: tables.epochs.distributedMicro, eligibleCount: tables.epochs.eligibleCount, merkleRoot: tables.epochs.merkleRoot }).from(tables.epochs).orderBy(desc(tables.epochs.id)).limit(20),
      ctx.db.select().from(tables.treasuryInflows).orderBy(desc(tables.treasuryInflows.id)).limit(100),
      ctx.db.select().from(tables.models).orderBy(tables.models.sortOrder),
      ctx.db.select().from(tables.agentRegistries),
      ctx.db.select().from(tables.swaps).orderBy(desc(tables.swaps.id)).limit(50),
      ctx.db.select().from(tables.providerTopups).orderBy(desc(tables.providerTopups.id)).limit(50),
    ]);
    const mismatches = await ctx.ledger.reconcile();
    return toJson({ params, defaults: DEFAULT_PARAMS, exclusions, audit: auditRows, epochs, inflows, models, registries, swaps, topups, ledgerMismatches: mismatches, env: { chainId: ctx.env.CHAIN_ID, autoPublish: ctx.env.AUTO_PUBLISH_EPOCHS, allowAdjust: ctx.env.ALLOW_ADMIN_ADJUST } });
  });

  /** Helper: authenticate admin, verify signed action, run, audit. */
  const signed = <T>(action: string, schema: z.ZodType<T>, run: (payload: T, admin: string) => Promise<{ before?: unknown; after?: unknown; targetType?: string; targetId?: string; result?: unknown }>) =>
    async (req: FastifyRequest) => {
      const admin = await requireAdminSession(ctx, req);
      const { payload, signature } = await verifyAdminAction(ctx, admin, action, req.body);
      const parsed = schema.parse(payload);
      const r = await run(parsed, admin);
      await audit(ctx, { actor: admin, action, targetType: r.targetType, targetId: r.targetId, before: r.before, after: r.after ?? parsed, signature, ip: req.ip });
      return toJson(r.result ?? { ok: true });
    };

  app.post("/admin/params", signed("set_params", z.record(z.unknown()), async (payload, admin) => {
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (!(k in paramSchemas)) throw badRequest(`unknown param ${k}`);
      const r = await ctx.params.set(k as keyof Params, v, admin, null);
      before[k] = r.before;
      after[k] = r.after;
    }
    await ctx.kv.del("public:overview");
    return { before, after, targetType: "params" };
  }));

  app.post("/admin/exclusions", signed("add_exclusion", z.object({ address, reason: z.enum(["lp", "treasury", "vault", "ops", "protocol", "burn", "blacklist"]), note: z.string().max(200).optional() }), async (p, admin) => {
    await ctx.db.insert(tables.excludedAddresses).values({ ...p, addedBy: admin }).onConflictDoUpdate({ target: tables.excludedAddresses.address, set: { reason: p.reason, note: p.note, active: true, addedBy: admin } });
    return { targetType: "exclusion", targetId: p.address };
  }));

  app.post("/admin/exclusions/remove", signed("remove_exclusion", z.object({ address }), async (p) => {
    const rows = await ctx.db.update(tables.excludedAddresses).set({ active: false }).where(eq(tables.excludedAddresses.address, p.address)).returning();
    if (!rows.length) throw notFound("not excluded");
    return { targetType: "exclusion", targetId: p.address };
  }));

  app.post("/admin/swaps", signed("record_swap", z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), bucket: z.enum(["pool", "vault", "ops"]), note: z.string().max(300).optional() }), async (p, admin) => {
    const row = await verifyAndRecordSwap(ctx, { txHash: p.txHash as `0x${string}`, bucket: p.bucket, note: p.note, actor: admin });
    await ctx.kv.del("public:overview");
    return { targetType: "swap", targetId: p.txHash, after: row, result: row };
  }));

  app.post("/admin/topups", signed("record_topup", z.object({ provider: z.string().min(1).max(50), amount: z.string(), proofRef: z.string().min(3).max(200), note: z.string().max(300).optional() }), async (p, admin) => {
    const [row] = await ctx.db.insert(tables.providerTopups).values({ provider: p.provider, amountMicro: parseKwota(p.amount), proofRef: p.proofRef, note: p.note, recordedBy: admin }).returning();
    await ctx.kv.del("public:overview");
    return { targetType: "topup", targetId: String(row!.id), result: row };
  }));

  app.post("/admin/inflows/classify", signed("classify_inflow", z.object({ id: z.string().regex(/^\d+$/), classification: z.enum(["fee", "non_fee"]), note: z.string().min(3).max(300) }), async (p, admin) => {
    const [before] = await ctx.db.select().from(tables.treasuryInflows).where(eq(tables.treasuryInflows.id, BigInt(p.id)));
    if (!before) throw notFound("inflow not found");
    await ctx.db.update(tables.treasuryInflows).set({ classification: p.classification, classifiedBy: admin, classificationNote: p.note }).where(eq(tables.treasuryInflows.id, BigInt(p.id)));
    await ctx.kv.del("public:overview");
    return { targetType: "inflow", targetId: p.id, before: { classification: before.classification } };
  }));

  app.post("/admin/epochs/compute", signed("compute_epoch", z.object({ epochId: z.number().int().positive() }), async (p) => {
    const r = await engine.compute(p.epochId);
    return { targetType: "epoch", targetId: String(p.epochId), after: { root: r.root, budget: r.budget, distributed: r.distributedMicro }, result: { root: r.root, sha256: r.sha256, eligible: r.eligibleCount } };
  }));

  app.post("/admin/epochs/publish", signed("publish_epoch", z.object({ epochId: z.number().int().positive() }), async (p, admin) => {
    const r = await engine.publish(p.epochId, `admin:${admin}`);
    await ctx.kv.del("public:overview");
    return { targetType: "epoch", targetId: String(p.epochId), result: r };
  }));

  app.post("/admin/epochs/onchain", signed("record_epoch_tx", z.object({ epochId: z.number().int().positive(), txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }), async (p) => {
    await ctx.db.update(tables.epochs).set({ onchainTx: p.txHash.toLowerCase() }).where(eq(tables.epochs.id, p.epochId));
    return { targetType: "epoch", targetId: String(p.epochId) };
  }));

  app.post("/admin/models", signed("upsert_model", z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9._/-]{1,80}$/), provider: z.string().min(1), providerModelId: z.string().min(1), displayName: z.string().min(1).max(80),
    contextLength: z.number().int().positive().nullable().optional(), inputPricePerMTok: z.string(), outputPricePerMTok: z.string(), markupBps: z.number().int().min(0).max(10_000).default(0),
    enabled: z.boolean().default(true), sortOrder: z.number().int().default(0),
  }), async (p) => {
    const v = {
      id: p.id, provider: p.provider, providerModelId: p.providerModelId, displayName: p.displayName, contextLength: p.contextLength ?? null,
      inputPriceMicroPerMTok: parseKwota(p.inputPricePerMTok), outputPriceMicroPerMTok: parseKwota(p.outputPricePerMTok), markupBps: p.markupBps, enabled: p.enabled, sortOrder: p.sortOrder,
    };
    const [before] = await ctx.db.select().from(tables.models).where(eq(tables.models.id, p.id));
    await ctx.db.insert(tables.models).values(v).onConflictDoUpdate({ target: tables.models.id, set: v });
    return { targetType: "model", targetId: p.id, before };
  }));

  app.post("/admin/adjust", signed("adjust_balance", z.object({ address, amount: z.string().regex(/^-?\d+(\.\d{1,6})?$/), note: z.string().min(3).max(200) }), async (p, admin) => {
    if (!ctx.env.ALLOW_ADMIN_ADJUST) throw badRequest("balance adjustments are disabled (ALLOW_ADMIN_ADJUST=false)");
    const neg = p.amount.startsWith("-");
    const delta = parseKwota(neg ? p.amount.slice(1) : p.amount) * (neg ? -1n : 1n);
    const user = await ctx.ledger.ensureUser(p.address);
    const acc = await ctx.ledger.holderAccount(user.id);
    const entry = await ctx.ledger.post({ accountId: acc.id, deltaMicro: delta, kind: "admin_adjust", refType: "admin", refId: `${Date.now()}:${p.address}`, actor: `admin:${admin}` });
    await ctx.kv.del("public:overview");
    return { targetType: "account", targetId: p.address, after: { delta: delta.toString(), balance: entry.balanceAfterMicro.toString(), note: p.note }, result: entry };
  }));

  app.post("/admin/registries", signed("upsert_registry", z.object({ address, name: z.string().min(1).max(64), adapter: z.enum(["erc8004_v1"]).default("erc8004_v1"), enabled: z.boolean().default(true) }), async (p) => {
    const [row] = await ctx.db
      .insert(tables.agentRegistries)
      .values({ chainId: ctx.env.CHAIN_ID, address: p.address, name: p.name, adapter: p.adapter, enabled: p.enabled })
      .onConflictDoUpdate({ target: [tables.agentRegistries.chainId, tables.agentRegistries.address], set: { name: p.name, adapter: p.adapter, enabled: p.enabled } })
      .returning();
    return { targetType: "registry", targetId: p.address, result: row };
  }));
}
