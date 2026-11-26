import { and, desc, eq, inArray, lt, gte, sql } from "drizzle-orm";
import { tables } from "@kwota/db";
import {
  allocateEpoch, computeTwab, epochBudget, epochRoot, serializeSnapshot,
  type EpochSnapshot, type TransferEvent,
} from "@kwota/core";
import type { Ctx } from "../context";
import { excludedSet } from "../lib/addresses";

export const KWOTA_CURSOR = "kwota_transfers";

export class EpochEngine {
  constructor(private ctx: Ctx) {}

  private get token() {
    return this.ctx.env.KWOTA_TOKEN_ADDRESS ?? null;
  }

  /** Make sure epoch rows exist up to "now"; returns the currently open epoch. */
  async ensureSchedule(now = Math.floor(Date.now() / 1000)) {
    const p = await this.ctx.params.all();
    const [last] = await this.ctx.db.select().from(tables.epochs).orderBy(desc(tables.epochs.id)).limit(1);
    if (!last) {
      const genesis = this.ctx.env.EPOCH_GENESIS_TIME || Math.floor(now / p.epoch_seconds) * p.epoch_seconds;
      const [e] = await this.ctx.db
        .insert(tables.epochs)
        .values({ id: 1, startTime: genesis, endTime: genesis + p.epoch_seconds })
        .onConflictDoNothing()
        .returning();
      return e ?? (await this.get(1))!;
    }
    let cur = last;
    while (cur.endTime <= now) {
      const [next] = await this.ctx.db
        .insert(tables.epochs)
        .values({ id: cur.id + 1, startTime: cur.endTime, endTime: cur.endTime + p.epoch_seconds })
        .onConflictDoNothing()
        .returning();
      cur = next ?? (await this.get(cur.id + 1))!;
    }
    return cur;
  }

  async get(id: number) {
    const [e] = await this.ctx.db.select().from(tables.epochs).where(eq(tables.epochs.id, id));
    return e ?? null;
  }

  async indexedUntil(): Promise<{ block: bigint; time: number } | null> {
    const [c] = await this.ctx.db.select().from(tables.indexerCursors).where(eq(tables.indexerCursors.name, KWOTA_CURSOR));
    return c ? { block: c.lastBlock, time: c.lastBlockTime } : null;
  }

  async openingBalances(token: string, before: number): Promise<Map<string, bigint>> {
    const rows = (await this.ctx.db.execute(sql`
      select a, sum(d)::text as bal from (
        select to_address as a, amount_raw as d from token_transfers where token = ${token} and block_time < ${before}
        union all
        select from_address as a, -amount_raw as d from token_transfers where token = ${token} and block_time < ${before}
      ) x where a <> '0x0000000000000000000000000000000000000000' group by a having sum(d) <> 0`)) as unknown as { a: string; bal: string }[];
    return new Map(rows.map((r) => [r.a.trim().toLowerCase(), BigInt(r.bal)]));
  }

  async windowTransfers(token: string, start: number, end: number): Promise<TransferEvent[]> {
    const rows = await this.ctx.db
      .select()
      .from(tables.tokenTransfers)
      .where(and(eq(tables.tokenTransfers.token, token), gte(tables.tokenTransfers.blockTime, start), lt(tables.tokenTransfers.blockTime, end)));
    return rows.map((r) => ({
      from: r.from.toLowerCase(), to: r.to.toLowerCase(), amount: r.amount, timestamp: r.blockTime, blockNumber: r.blockNumber, logIndex: r.logIndex,
    }));
  }

  /** Realized pool funds not yet distributed: Σ verified pool swaps − Σ distributed (other epochs) + Σ expired. */
  async unallocatedPoolMicro(excludeEpochId?: number): Promise<bigint> {
    const [{ credited }] = (await this.ctx.db.execute(
      sql`select coalesce(sum(pool_credit_micro), 0)::text as credited from swaps where verified and bucket = 'pool'`,
    )) as unknown as [{ credited: string }];
    const [{ distributed }] = (await this.ctx.db.execute(
      sql`select coalesce(sum(distributed_micro), 0)::text as distributed from epochs where status in ('computed','published') and id <> ${excludeEpochId ?? -1}`,
    )) as unknown as [{ distributed: string }];
    const [{ expired }] = (await this.ctx.db.execute(
      sql`select coalesce(-sum(delta_micro), 0)::text as expired from ledger_entries where kind = 'expiry'`,
    )) as unknown as [{ expired: string }];
    return BigInt(credited) - BigInt(distributed) + BigInt(expired);
  }

  /** Compute allocations + Merkle root for a closed epoch (idempotent, deterministic). */
  async compute(epochId: number) {
    const token = this.token;
    if (!token) throw new Error("KWOTA_TOKEN_ADDRESS not configured");
    const epoch = await this.get(epochId);
    if (!epoch) throw new Error(`epoch ${epochId} not found`);
    if (epoch.status === "published") throw new Error(`epoch ${epochId} already published`);
    const idx = await this.indexedUntil();
    if (!idx || idx.time < epoch.endTime) throw new Error(`indexer has not reached epoch ${epochId} end yet`);

    const p = await this.ctx.params.all();
    const prev = epochId > 1 ? await this.get(epochId - 1) : null;
    if (prev && prev.status !== "published") throw new Error(`previous epoch ${prev.id} not published`);
    const dustIn = prev?.dustOutMicro ?? 0n;
    const budget = epochBudget(await this.unallocatedPoolMicro(epochId), dustIn, { distributeBps: p.epoch_distribute_bps });

    const opening = await this.openingBalances(token, epoch.startTime);
    const transfers = await this.windowTransfers(token, epoch.startTime, epoch.endTime);
    const twabs = computeTwab({ openingBalances: opening, transfers, start: epoch.startTime, end: epoch.endTime });
    const excluded = await excludedSet(this.ctx.db, this.ctx.env);
    const result = allocateEpoch(twabs.values(), {
      budgetMicro: budget, minHoldingRaw: BigInt(p.min_holding_raw), minHoldingMode: p.min_holding_mode, excluded,
    });
    const root = epochRoot(epochId, result.allocations);
    const paramsUsed = {
      min_holding_raw: p.min_holding_raw, min_holding_mode: p.min_holding_mode, epoch_distribute_bps: p.epoch_distribute_bps,
      epoch_seconds: epoch.endTime - epoch.startTime, versions: p._versions,
    };
    const snapshot: EpochSnapshot = {
      version: 1, chainId: this.ctx.env.CHAIN_ID, token, epochId, start: epoch.startTime, end: epoch.endTime,
      startBlock: "", endBlock: idx.block.toString(),
      budgetMicro: budget.toString(), distributedMicro: result.distributedMicro.toString(), dustMicro: result.dustMicro.toString(),
      totalWeight: result.totalWeight.toString(), params: paramsUsed, excluded: [...excluded].sort(), merkleRoot: root,
      allocations: result.allocations.map((a) => ({
        address: a.address, twab: a.twab.toString(), balanceSeconds: a.balanceSeconds.toString(), sharePpm: a.sharePpm, kwotaMicro: a.kwotaMicro.toString(),
      })),
    };
    const { json, sha256 } = serializeSnapshot(snapshot);

    await this.ctx.db.transaction(async (tx) => {
      await tx.delete(tables.epochAllocations).where(eq(tables.epochAllocations.epochId, epochId));
      if (result.allocations.length) {
        for (let i = 0; i < result.allocations.length; i += 1000) {
          await tx.insert(tables.epochAllocations).values(
            result.allocations.slice(i, i + 1000).map((a) => ({
              epochId, address: a.address, twab: a.twab, balanceSeconds: a.balanceSeconds, sharePpm: a.sharePpm, kwotaMicro: a.kwotaMicro,
            })),
          );
        }
      }
      await tx
        .update(tables.epochs)
        .set({
          status: "computed", budgetMicro: budget, dustInMicro: dustIn, dustOutMicro: result.dustMicro, distributedMicro: result.distributedMicro,
          totalWeight: result.totalWeight, eligibleCount: result.eligibleCount, merkleRoot: root, snapshotSha256: sha256, snapshotJson: json,
          paramsUsed, endBlock: idx.block,
        })
        .where(eq(tables.epochs.id, epochId));
    });
    return { epochId, budget, root, sha256, ...result };
  }

  /** Credit computed allocations to holder ledgers, then run expiry. */
  async publish(epochId: number, actor: string) {
    const epoch = await this.get(epochId);
    if (!epoch || epoch.status !== "computed") throw new Error(`epoch ${epochId} is not in 'computed' state`);
    const allocs = await this.ctx.db.select().from(tables.epochAllocations).where(eq(tables.epochAllocations.epochId, epochId));
    for (const a of allocs) {
      if (a.kwotaMicro <= 0n) continue;
      const user = await this.ctx.ledger.ensureUser(a.address);
      const acc = await this.ctx.ledger.holderAccount(user.id);
      const [dup] = await this.ctx.db
        .select({ id: tables.ledgerEntries.id })
        .from(tables.ledgerEntries)
        .where(and(eq(tables.ledgerEntries.accountId, acc.id), eq(tables.ledgerEntries.kind, "epoch_credit"), eq(tables.ledgerEntries.refId, String(epochId))));
      if (dup) continue;
      await this.ctx.ledger.post({ accountId: acc.id, deltaMicro: a.kwotaMicro, kind: "epoch_credit", refType: "epoch", refId: String(epochId), actor });
    }
    await this.ctx.db.update(tables.epochs).set({ status: "published", publishedAt: new Date() }).where(eq(tables.epochs.id, epochId));
    const expired = await this.expire(epochId, actor);
    return { credited: allocs.length, expired };
  }

  /**
   * FIFO-equivalent expiry: a holder's free balance above what they received in the
   * last N epochs is older than N epochs and expires back to the pool.
   */
  async expire(currentEpochId: number, actor: string) {
    const p = await this.ctx.params.all();
    const n = p.kwota_expiry_epochs;
    if (n <= 0) return 0n;
    const minEpoch = currentEpochId - n + 1;
    const rows = (await this.ctx.db.execute(sql`
      select a.id, a.balance_micro::text as bal, a.reserved_micro::text as res,
        coalesce((select sum(delta_micro) from ledger_entries l where l.account_id = a.id and l.kind = 'epoch_credit'
                  and l.ref_id::int >= ${minEpoch}), 0)::text as recent
      from kwota_accounts a where a.type = 'holder' and a.balance_micro > 0`)) as unknown as { id: number; bal: string; res: string; recent: string }[];
    let total = 0n;
    for (const r of rows) {
      const excess = BigInt(r.bal) - BigInt(r.res) - BigInt(r.recent);
      if (excess <= 0n) continue;
      const [dup] = await this.ctx.db
        .select({ id: tables.ledgerEntries.id })
        .from(tables.ledgerEntries)
        .where(and(eq(tables.ledgerEntries.accountId, r.id), eq(tables.ledgerEntries.kind, "expiry"), eq(tables.ledgerEntries.refId, String(currentEpochId))));
      if (dup) continue;
      await this.ctx.ledger.post({ accountId: r.id, deltaMicro: -excess, kind: "expiry", refType: "epoch", refId: String(currentEpochId), actor });
      total += excess;
    }
    return total;
  }

  /** Worker step: compute + (optionally) publish every closed epoch the indexer has fully covered. */
  async tick(actor = "worker") {
    await this.ensureSchedule();
    const idx = await this.indexedUntil();
    if (!idx || !this.token) return [];
    const pending = await this.ctx.db
      .select()
      .from(tables.epochs)
      .where(and(inArray(tables.epochs.status, ["open", "closing", "computed"]), lt(tables.epochs.endTime, idx.time + 1)))
      .orderBy(tables.epochs.id);
    const done: number[] = [];
    for (const e of pending) {
      if (e.status !== "computed") await this.compute(e.id);
      if (!this.ctx.env.AUTO_PUBLISH_EPOCHS) break; // wait for admin to publish before computing the next one
      await this.publish(e.id, actor);
      done.push(e.id);
    }
    return done;
  }

  /** Live estimate for an address in the open epoch (projected budget, time-weighted so far). */
  async estimate(address: string, now = Math.floor(Date.now() / 1000)) {
    const token = this.token;
    const epoch = await this.ensureSchedule(now);
    if (!token) return { epochId: epoch.id, estimateMicro: 0n, sharePpm: 0, projectedBudgetMicro: 0n, endsAt: epoch.endTime };
    const p = await this.ctx.params.all();
    const until = Math.min(now, epoch.endTime);
    if (until <= epoch.startTime) return { epochId: epoch.id, estimateMicro: 0n, sharePpm: 0, projectedBudgetMicro: 0n, endsAt: epoch.endTime };
    const cacheKey = `estimate:${epoch.id}:${Math.floor(now / 60)}`;
    let weights: Map<string, bigint>;
    const cached = await this.ctx.kv.get(cacheKey);
    if (cached) weights = new Map(Object.entries(JSON.parse(cached) as Record<string, string>).map(([k, v]) => [k, BigInt(v)]));
    else {
      const opening = await this.openingBalances(token, epoch.startTime);
      const transfers = await this.windowTransfers(token, epoch.startTime, until);
      const twabs = computeTwab({ openingBalances: opening, transfers, start: epoch.startTime, end: until });
      const excluded = await excludedSet(this.ctx.db, this.ctx.env);
      const res = allocateEpoch(twabs.values(), { budgetMicro: 1_000_000_000_000n, minHoldingRaw: BigInt(p.min_holding_raw), minHoldingMode: p.min_holding_mode, excluded });
      weights = new Map(res.allocations.map((a) => [a.address, a.balanceSeconds]));
      await this.ctx.kv.set(cacheKey, JSON.stringify(Object.fromEntries([...weights].map(([k, v]) => [k, v.toString()]))), 90);
    }
    const total = [...weights.values()].reduce((s, v) => s + v, 0n);
    const mine = weights.get(address.toLowerCase()) ?? 0n;
    const prev = epoch.id > 1 ? await this.get(epoch.id - 1) : null;
    const projected = epochBudget(await this.unallocatedPoolMicro(epoch.id), prev?.dustOutMicro ?? 0n, { distributeBps: p.epoch_distribute_bps });
    const estimateMicro = total > 0n ? (projected * mine) / total : 0n;
    return { epochId: epoch.id, estimateMicro, sharePpm: total > 0n ? Number((mine * 1_000_000n) / total) : 0, projectedBudgetMicro: projected, endsAt: epoch.endTime };
  }
}
