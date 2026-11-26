import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { tables, type Db } from "@kwota/db";
import { utcDay } from "@kwota/core";
import type { Ledger } from "../ledger";
import type { ParamService } from "../params";
import type { AgentRegistryAdapter } from "./registry";
import { badRequest, forbidden, notFound } from "../lib/errors";

export class AgentService {
  constructor(
    private db: Db,
    private ledger: Ledger,
    private params: ParamService,
    private registry: AgentRegistryAdapter,
  ) {}

  async listRegistries() {
    return this.db.select().from(tables.agentRegistries).where(eq(tables.agentRegistries.enabled, true));
  }

  async register(opts: { userId: number; userAddress: string; registryId: number; agentTokenId: bigint; name?: string; dailyLimitMicro: bigint }) {
    const p = await this.params.all();
    if (opts.dailyLimitMicro <= 0n || opts.dailyLimitMicro > BigInt(p.agent_daily_limit_max_micro)) {
      throw badRequest("daily limit out of range");
    }
    const [reg] = await this.db.select().from(tables.agentRegistries).where(eq(tables.agentRegistries.id, opts.registryId));
    if (!reg || !reg.enabled) throw badRequest("unknown registry");
    const resolved = await this.registry.resolve(reg.address as `0x${string}`, opts.agentTokenId);
    if (!resolved) throw badRequest("agent not found in registry");
    if (resolved.owner !== opts.userAddress.toLowerCase()) throw forbidden("only the agent owner (ownerOf) can register it");
    const [{ count }] = (await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tables.agents)
      .where(eq(tables.agents.allocatorUserId, opts.userId))) as [{ count: number }];
    if (count >= p.max_agents_per_holder) throw badRequest("agent limit reached");

    const [existing] = await this.db
      .select()
      .from(tables.agents)
      .where(and(eq(tables.agents.registryId, reg.id), eq(tables.agents.agentTokenId, opts.agentTokenId)));
    if (existing) {
      if (existing.allocatorUserId !== opts.userId) {
        // previous allocator lost ownership; new owner may take over only after the old one reclaimed
        const acc = await this.ledger.agentAccount(existing.allocatorUserId, existing.id);
        if (acc.balanceMicro > 0n) throw badRequest("agent still holds kwota from a previous owner");
      }
      const [upd] = await this.db
        .update(tables.agents)
        .set({ ownerAddress: resolved.owner, agentWallet: resolved.agentWallet, allocatorUserId: opts.userId, status: "active", dailyLimitMicro: opts.dailyLimitMicro, name: opts.name ?? existing.name, lastVerifiedAt: new Date() })
        .where(eq(tables.agents.id, existing.id))
        .returning();
      return upd!;
    }
    const [agent] = await this.db
      .insert(tables.agents)
      .values({
        registryId: reg.id, agentTokenId: opts.agentTokenId, name: opts.name, ownerAddress: resolved.owner,
        agentWallet: resolved.agentWallet, allocatorUserId: opts.userId, dailyLimitMicro: opts.dailyLimitMicro, lastVerifiedAt: new Date(),
      })
      .returning();
    await this.ledger.agentAccount(opts.userId, agent!.id);
    return agent!;
  }

  async get(agentId: number) {
    const [a] = await this.db.select().from(tables.agents).where(eq(tables.agents.id, agentId));
    return a ?? null;
  }

  async findByToken(registry: string, agentTokenId: bigint) {
    const [row] = await this.db
      .select({ agent: tables.agents, registry: tables.agentRegistries })
      .from(tables.agents)
      .innerJoin(tables.agentRegistries, eq(tables.agents.registryId, tables.agentRegistries.id))
      .where(and(eq(tables.agentRegistries.address, registry.toLowerCase()), eq(tables.agents.agentTokenId, agentTokenId)));
    return row ?? null;
  }

  private async owned(userId: number, agentId: number) {
    const a = await this.get(agentId);
    if (!a) throw notFound("agent not found");
    if (a.allocatorUserId !== userId) throw forbidden("not your agent");
    return a;
  }

  async listForUser(userId: number) {
    const rows = await this.db
      .select({ agent: tables.agents, account: tables.kwotaAccounts, registry: tables.agentRegistries })
      .from(tables.agents)
      .leftJoin(tables.kwotaAccounts, eq(tables.kwotaAccounts.agentId, tables.agents.id))
      .innerJoin(tables.agentRegistries, eq(tables.agents.registryId, tables.agentRegistries.id))
      .where(eq(tables.agents.allocatorUserId, userId));
    const day = utcDay(Date.now());
    const usage = await this.db
      .select()
      .from(tables.agentDailyUsage)
      .where(eq(tables.agentDailyUsage.day, day));
    const spent = new Map(usage.map((u) => [u.agentId, u.spentMicro]));
    return rows.map((r) => ({ ...r, spentTodayMicro: spent.get(r.agent.id) ?? 0n }));
  }

  async allocate(userId: number, agentId: number, amountMicro: bigint, actor: string) {
    const a = await this.owned(userId, agentId);
    if (a.status !== "active") throw badRequest("agent is not active");
    if (amountMicro <= 0n) throw badRequest("amount must be positive");
    const holder = await this.ledger.holderAccount(userId);
    const agentAcc = await this.ledger.agentAccount(userId, agentId);
    return this.ledger.transfer({
      fromAccountId: holder.id, toAccountId: agentAcc.id, amountMicro, kindOut: "allocation_out", kindIn: "allocation_in",
      refType: "agent_allocation", refId: `${agentId}:${randomUUID()}`, actor,
    });
  }

  /** Return the agent's free balance (balance − reserved) to the holder. */
  async reclaim(userId: number, agentId: number, actor: string, amountMicro?: bigint) {
    await this.owned(userId, agentId);
    const holder = await this.ledger.holderAccount(userId);
    const agentAcc = await this.ledger.agentAccount(userId, agentId);
    const free = agentAcc.balanceMicro - agentAcc.reservedMicro;
    const amt = amountMicro ?? free;
    if (amt <= 0n) return null;
    if (amt > free) throw badRequest("amount exceeds free agent balance");
    return this.ledger.transfer({
      fromAccountId: agentAcc.id, toAccountId: holder.id, amountMicro: amt, kindOut: "reclaim_out", kindIn: "reclaim_in",
      refType: "agent_reclaim", refId: `${agentId}:${randomUUID()}`, actor,
    });
  }

  async setStatus(userId: number, agentId: number, status: "active" | "stopped") {
    const a = await this.owned(userId, agentId);
    if (a.status === "frozen" && status === "active") throw badRequest("agent is frozen (ownership changed); re-register");
    const [u] = await this.db.update(tables.agents).set({ status }).where(eq(tables.agents.id, agentId)).returning();
    return u!;
  }

  async setDailyLimit(userId: number, agentId: number, dailyLimitMicro: bigint) {
    await this.owned(userId, agentId);
    const p = await this.params.all();
    if (dailyLimitMicro <= 0n || dailyLimitMicro > BigInt(p.agent_daily_limit_max_micro)) throw badRequest("daily limit out of range");
    const [u] = await this.db.update(tables.agents).set({ dailyLimitMicro }).where(eq(tables.agents.id, agentId)).returning();
    return u!;
  }

  /** Re-check ownership on-chain. If the NFT moved, freeze the agent (kwota stays reclaimable by the allocator). */
  async refreshOwnership(agentId: number) {
    const row = await this.db
      .select({ agent: tables.agents, registry: tables.agentRegistries })
      .from(tables.agents)
      .innerJoin(tables.agentRegistries, eq(tables.agents.registryId, tables.agentRegistries.id))
      .where(eq(tables.agents.id, agentId));
    const r = row[0];
    if (!r) return null;
    const resolved = await this.registry.resolve(r.registry.address as `0x${string}`, r.agent.agentTokenId);
    const [allocator] = await this.db.select().from(tables.users).where(eq(tables.users.id, r.agent.allocatorUserId));
    const ownerChanged = !resolved || resolved.owner !== allocator!.address;
    const [u] = await this.db
      .update(tables.agents)
      .set({
        status: ownerChanged ? "frozen" : r.agent.status,
        ownerAddress: resolved?.owner ?? r.agent.ownerAddress,
        agentWallet: resolved?.agentWallet ?? r.agent.agentWallet,
        lastVerifiedAt: new Date(),
      })
      .where(eq(tables.agents.id, agentId))
      .returning();
    return u!;
  }

  // ── daily limit accounting (UTC day) ────────────────────────────
  async reserveDaily(agentId: number, amountMicro: bigint, limitMicro: bigint): Promise<string | null> {
    const day = utcDay(Date.now());
    await this.db.insert(tables.agentDailyUsage).values({ agentId, day }).onConflictDoNothing();
    const rows = await this.db
      .update(tables.agentDailyUsage)
      .set({ reservedMicro: sql`${tables.agentDailyUsage.reservedMicro} + ${amountMicro}` })
      .where(
        and(
          eq(tables.agentDailyUsage.agentId, agentId),
          eq(tables.agentDailyUsage.day, day),
          sql`${tables.agentDailyUsage.spentMicro} + ${tables.agentDailyUsage.reservedMicro} + ${amountMicro} <= ${limitMicro}`,
        ),
      )
      .returning();
    return rows.length ? day : null;
  }

  async settleDaily(agentId: number, day: string, reservedMicro: bigint, chargedMicro: bigint) {
    await this.db
      .update(tables.agentDailyUsage)
      .set({
        reservedMicro: sql`greatest(${tables.agentDailyUsage.reservedMicro} - ${reservedMicro}, 0)`,
        spentMicro: sql`${tables.agentDailyUsage.spentMicro} + ${chargedMicro}`,
      })
      .where(and(eq(tables.agentDailyUsage.agentId, agentId), eq(tables.agentDailyUsage.day, day)));
  }
}
