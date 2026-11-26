import { eq } from "drizzle-orm";
import { tables } from "@kwota/db";
import type { FastifyRequest } from "fastify";
import type { Ctx } from "../context";
import { parseApiKey, secretMatches } from "../auth/apiKeys";
import { verifySession } from "../auth/session";
import { readAgentHeaders, verifyAgentRequest } from "../agents/eip712";
import { forbidden, tooMany, unauthorized } from "../lib/errors";

export interface Principal {
  userId: number;
  userAddress: string;
  accountId: number;
  apiKeyId: number | null;
  agent: { id: number; dailyLimitMicro: bigint } | null;
  authMethod: "api_key" | "eip712" | "session";
  nonce: string | null;
  rpmLimit: number;
  maxCostMicro: bigint;
}

function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1]!.trim() : null;
}

export async function sessionAddress(ctx: Ctx, req: FastifyRequest): Promise<string | null> {
  const t = bearer(req);
  if (!t) return null;
  return verifySession(ctx.env.SESSION_SECRET, t)?.address ?? null;
}

async function agentPrincipal(ctx: Ctx, agentId: number, base: Omit<Principal, "userId" | "userAddress" | "accountId" | "agent">) {
  const a = await ctx.agents.get(agentId);
  if (!a) throw unauthorized("unknown agent");
  if (a.status !== "active") throw forbidden(`agent is ${a.status}`, "agent_inactive");
  const [u] = await ctx.db.select().from(tables.users).where(eq(tables.users.id, a.allocatorUserId));
  const acc = await ctx.ledger.agentAccount(a.allocatorUserId, a.id);
  return { ...base, userId: u!.id, userAddress: u!.address, accountId: acc.id, agent: { id: a.id, dailyLimitMicro: a.dailyLimitMicro } };
}

/** Resolve who is calling the gateway: agent EIP-712 signature, API key (holder or agent), or SIWE session. */
export async function resolvePrincipal(ctx: Ctx, req: FastifyRequest, rawBody: string): Promise<Principal> {
  const p = await ctx.params.all();
  const defaults = { rpmLimit: p.rpm_per_key, maxCostMicro: BigInt(p.max_cost_per_request_micro), nonce: null, apiKeyId: null };

  const signed = readAgentHeaders(req.headers);
  if (signed) {
    const found = await ctx.agents.findByToken(signed.registry, signed.agentId);
    if (!found) throw unauthorized("agent not registered with KWOTA");
    const { nonce } = await verifyAgentRequest({
      headers: signed, rawBody, chainId: ctx.env.CHAIN_ID, expectedSigner: found.agent.agentWallet as `0x${string}`, kv: ctx.kv, client: ctx.client,
    });
    return agentPrincipal(ctx, found.agent.id, { ...defaults, authMethod: "eip712", nonce });
  }

  const token = bearer(req);
  if (!token) throw unauthorized("missing API key");

  const parsed = parseApiKey(token);
  if (parsed) {
    const [key] = await ctx.db.select().from(tables.apiKeys).where(eq(tables.apiKeys.prefix, parsed.prefix));
    if (!key || !secretMatches(parsed.secret, key.secretHash)) throw unauthorized("invalid API key", "invalid_api_key");
    if (key.revokedAt) throw unauthorized("API key revoked", "invalid_api_key");
    void ctx.db.update(tables.apiKeys).set({ lastUsedAt: new Date() }).where(eq(tables.apiKeys.id, key.id)).catch(() => {});
    const base = {
      ...defaults,
      apiKeyId: key.id,
      authMethod: "api_key" as const,
      rpmLimit: key.rpmLimit ?? defaults.rpmLimit,
      maxCostMicro: key.maxCostPerRequestMicro && key.maxCostPerRequestMicro < defaults.maxCostMicro ? key.maxCostPerRequestMicro : defaults.maxCostMicro,
    };
    if (key.agentId) return agentPrincipal(ctx, key.agentId, base);
    const [u] = await ctx.db.select().from(tables.users).where(eq(tables.users.id, key.userId));
    const acc = await ctx.ledger.holderAccount(u!.id);
    return { ...base, userId: u!.id, userAddress: u!.address, accountId: acc.id, agent: null };
  }

  const session = verifySession(ctx.env.SESSION_SECRET, token);
  if (session) {
    const u = await ctx.ledger.ensureUser(session.address);
    const acc = await ctx.ledger.holderAccount(u.id);
    return { ...defaults, authMethod: "session", userId: u.id, userAddress: u.address, accountId: acc.id, agent: null };
  }
  throw unauthorized("invalid API key", "invalid_api_key");
}

/** Fixed-window per-minute limits per credential and per wallet. */
export async function enforceRateLimit(ctx: Ctx, pr: Principal) {
  const p = await ctx.params.all();
  const minute = Math.floor(Date.now() / 60_000);
  const credKey = pr.agent ? `agent:${pr.agent.id}` : pr.apiKeyId ? `key:${pr.apiKeyId}` : `session:${pr.userId}`;
  const c1 = await ctx.kv.incr(`rl:${credKey}:${minute}`, 70);
  if (c1 > pr.rpmLimit) throw tooMany();
  const c2 = await ctx.kv.incr(`rl:wallet:${pr.userId}:${minute}`, 70);
  if (c2 > p.rpm_per_wallet) throw tooMany("wallet rate limit exceeded");
}
