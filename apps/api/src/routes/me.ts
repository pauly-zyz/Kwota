import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { tables } from "@kwota/db";
import { parseKwota } from "@kwota/core";
import type { Ctx } from "../context";
import { sessionAddress } from "../gateway/principal";
import { generateApiKey } from "../auth/apiKeys";
import { badRequest, notFound, unauthorized } from "../lib/errors";
import { toJson } from "../lib/json";
import { EpochEngine } from "../epoch/engine";

export async function requireUser(ctx: Ctx, req: FastifyRequest) {
  const address = await sessionAddress(ctx, req);
  if (!address) throw unauthorized("sign in with your wallet first");
  const user = await ctx.ledger.ensureUser(address);
  return user;
}

const kwotaAmount = z.string().transform((s, c) => {
  try {
    return parseKwota(s);
  } catch {
    c.addIssue({ code: "custom", message: "invalid kwota amount" });
    return z.NEVER;
  }
});
export { kwotaAmount };

export async function meRoutes(app: FastifyInstance, ctx: Ctx) {
  const engine = new EpochEngine(ctx);

  app.get("/me", async (req) => {
    const user = await requireUser(ctx, req);
    const acc = await ctx.ledger.holderAccount(user.id);
    const [bal] = await ctx.db.select().from(tables.holderBalances).where(eq(tables.holderBalances.address, user.address));
    const estimate = await engine.estimate(user.address);
    return toJson({
      address: user.address,
      isAdmin: ctx.env.ADMIN_ADDRESSES.includes(user.address),
      kwota: { balanceMicro: acc.balanceMicro, reservedMicro: acc.reservedMicro, availableMicro: acc.balanceMicro - acc.reservedMicro },
      indexedTokenBalanceRaw: bal?.balance ?? 0n,
      estimate,
    });
  });

  app.get("/me/ledger", async (req) => {
    const user = await requireUser(ctx, req);
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), before: z.coerce.bigint().optional() }).parse(req.query);
    const rows = await ctx.db
      .select({ entry: tables.ledgerEntries, accountType: tables.kwotaAccounts.type, agentId: tables.kwotaAccounts.agentId })
      .from(tables.ledgerEntries)
      .innerJoin(tables.kwotaAccounts, eq(tables.ledgerEntries.accountId, tables.kwotaAccounts.id))
      .where(and(eq(tables.kwotaAccounts.userId, user.id), q.before ? sql`${tables.ledgerEntries.id} < ${q.before}` : undefined))
      .orderBy(desc(tables.ledgerEntries.id))
      .limit(q.limit);
    return toJson(rows.map((r) => ({ ...r.entry, accountType: r.accountType, agentId: r.agentId })));
  });

  app.get("/me/usage", async (req) => {
    const user = await requireUser(ctx, req);
    const rows = await ctx.db.select().from(tables.usageRequests).where(eq(tables.usageRequests.userId, user.id)).orderBy(desc(tables.usageRequests.id)).limit(100);
    return toJson(rows);
  });

  app.get("/me/keys", async (req) => {
    const user = await requireUser(ctx, req);
    const rows = await ctx.db
      .select({ id: tables.apiKeys.id, name: tables.apiKeys.name, prefix: tables.apiKeys.prefix, agentId: tables.apiKeys.agentId, createdAt: tables.apiKeys.createdAt, lastUsedAt: tables.apiKeys.lastUsedAt, revokedAt: tables.apiKeys.revokedAt, rpmLimit: tables.apiKeys.rpmLimit, maxCostPerRequestMicro: tables.apiKeys.maxCostPerRequestMicro })
      .from(tables.apiKeys)
      .where(eq(tables.apiKeys.userId, user.id))
      .orderBy(desc(tables.apiKeys.id));
    return toJson(rows);
  });

  app.post("/me/keys", async (req) => {
    const user = await requireUser(ctx, req);
    const body = z.object({ name: z.string().min(1).max(64), agentId: z.number().int().positive().optional(), maxCostPerRequest: kwotaAmount.optional(), rpmLimit: z.number().int().min(1).max(1000).optional() }).parse(req.body);
    if (body.agentId) {
      const a = await ctx.agents.get(body.agentId);
      if (!a || a.allocatorUserId !== user.id) throw notFound("agent not found");
    }
    const active = await ctx.db.select({ id: tables.apiKeys.id }).from(tables.apiKeys).where(and(eq(tables.apiKeys.userId, user.id), isNull(tables.apiKeys.revokedAt)));
    if (active.length >= 20) throw badRequest("too many active keys");
    const k = generateApiKey();
    const [row] = await ctx.db
      .insert(tables.apiKeys)
      .values({ userId: user.id, agentId: body.agentId ?? null, name: body.name, prefix: k.prefix, secretHash: k.secretHash, maxCostPerRequestMicro: body.maxCostPerRequest ?? null, rpmLimit: body.rpmLimit ?? null })
      .returning();
    return toJson({ id: row!.id, name: row!.name, prefix: row!.prefix, agentId: row!.agentId, key: k.key, note: "Store this key now; it will not be shown again." });
  });

  app.delete("/me/keys/:id", async (req) => {
    const user = await requireUser(ctx, req);
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const rows = await ctx.db
      .update(tables.apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(tables.apiKeys.id, id), eq(tables.apiKeys.userId, user.id), isNull(tables.apiKeys.revokedAt)))
      .returning();
    if (!rows.length) throw notFound("key not found");
    return { revoked: true };
  });
}
