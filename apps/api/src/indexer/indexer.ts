import { eq, gt, inArray, sql } from "drizzle-orm";
import { parseAbiItem, type Log, type PublicClient } from "viem";
import { tables } from "@kwota/db";
import { splitAmount } from "@kwota/core";
import type { Ctx } from "../context";
import { KWOTA_CURSOR } from "../epoch/engine";
import { ZERO } from "../lib/addresses";

export const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const REORG_REWIND = 64n;

type TransferLog = Log<bigint, number, false, typeof TRANSFER_EVENT, true>;

export class Indexer {
  private blockTimes = new Map<bigint, { time: number; hash: string }>();
  constructor(private ctx: Ctx, private client: PublicClient) {}

  private async block(n: bigint) {
    const c = this.blockTimes.get(n);
    if (c) return c;
    const b = await this.client.getBlock({ blockNumber: n });
    const v = { time: Number(b.timestamp), hash: b.hash! };
    this.blockTimes.set(n, v);
    if (this.blockTimes.size > 5000) this.blockTimes.clear();
    return v;
  }

  private async cursor() {
    const [c] = await this.ctx.db.select().from(tables.indexerCursors).where(eq(tables.indexerCursors.name, KWOTA_CURSOR));
    return c ?? null;
  }

  /** Drop indexed data above `block` and rebuild derived balances (reorg recovery). */
  async rollback(block: bigint) {
    await this.ctx.db.transaction(async (tx) => {
      const inflows = await tx.select({ id: tables.treasuryInflows.id }).from(tables.treasuryInflows).where(gt(tables.treasuryInflows.blockNumber, block));
      if (inflows.length) {
        await tx.delete(tables.feeAllocations).where(inArray(tables.feeAllocations.inflowId, inflows.map((i) => i.id)));
        await tx.delete(tables.treasuryInflows).where(gt(tables.treasuryInflows.blockNumber, block));
      }
      await tx.delete(tables.tokenTransfers).where(gt(tables.tokenTransfers.blockNumber, block));
      const b = await this.block(block);
      await tx.update(tables.indexerCursors).set({ lastBlock: block, lastBlockHash: b.hash, lastBlockTime: b.time, updatedAt: new Date() }).where(eq(tables.indexerCursors.name, KWOTA_CURSOR));
    });
    this.blockTimes.clear();
    await this.rebuildBalances();
  }

  async rebuildBalances(addresses?: string[]) {
    const token = this.ctx.env.KWOTA_TOKEN_ADDRESS;
    if (!token) return;
    const filter = addresses?.length ? sql`and a in ${addresses}` : sql``;
    await this.ctx.db.transaction(async (tx) => {
      if (addresses?.length) await tx.delete(tables.holderBalances).where(inArray(tables.holderBalances.address, addresses));
      else await tx.delete(tables.holderBalances);
      await tx.execute(sql`
        insert into holder_balances (address, balance_raw, last_block)
        select a, sum(d), max(b) from (
          select to_address a, amount_raw d, block_number b from token_transfers where token = ${token}
          union all select from_address a, -amount_raw d, block_number b from token_transfers where token = ${token}
        ) x where a <> ${ZERO} ${filter} group by a having sum(d) <> 0`);
    });
  }

  /** One indexing step. Returns the block range processed (or null when caught up). */
  async tick(): Promise<{ from: bigint; to: bigint; transfers: number; inflows: number } | null> {
    const env = this.ctx.env;
    const token = env.KWOTA_TOKEN_ADDRESS;
    if (!token && !env.TREASURY_ADDRESS) return null;
    const head = (await this.client.getBlockNumber()) - BigInt(env.CONFIRMATIONS);
    let cur = await this.cursor();
    if (!cur) {
      const start = env.INDEXER_START_BLOCK > 0n ? env.INDEXER_START_BLOCK - 1n : 0n;
      const b = await this.block(start);
      await this.ctx.db.insert(tables.indexerCursors).values({ name: KWOTA_CURSOR, chainId: env.CHAIN_ID, lastBlock: start, lastBlockHash: b.hash, lastBlockTime: b.time });
      cur = (await this.cursor())!;
    } else if (cur.lastBlockHash) {
      const onchain = await this.client.getBlock({ blockNumber: cur.lastBlock });
      if (onchain.hash !== cur.lastBlockHash) {
        const target = cur.lastBlock > REORG_REWIND ? cur.lastBlock - REORG_REWIND : 0n;
        await this.rollback(target);
        return { from: target, to: target, transfers: 0, inflows: 0 };
      }
    }
    const from = cur.lastBlock + 1n;
    if (from > head) return null;
    const to = from + env.INDEXER_BATCH_BLOCKS - 1n < head ? from + env.INDEXER_BATCH_BLOCKS - 1n : head;

    const kwotaLogs: TransferLog[] = token
      ? ((await this.client.getLogs({ address: token, event: TRANSFER_EVENT, fromBlock: from, toBlock: to, strict: true })) as TransferLog[])
      : [];
    const feeTokens = env.TRACKED_FEE_TOKENS.length ? env.TRACKED_FEE_TOKENS : [];
    const treasuryLogs: TransferLog[] =
      env.TREASURY_ADDRESS && feeTokens.length
        ? ((await this.client.getLogs({
            address: feeTokens as `0x${string}`[], event: TRANSFER_EVENT, args: { to: env.TREASURY_ADDRESS }, fromBlock: from, toBlock: to, strict: true,
          })) as TransferLog[])
        : [];

    const blocks = new Set<bigint>([...kwotaLogs, ...treasuryLogs].map((l) => l.blockNumber));
    for (const b of blocks) await this.block(b);
    const toBlock = await this.block(to);

    const p = await this.ctx.params.all();
    const splitVersion = p._versions.fee_split ?? 0;
    let inflowCount = 0;
    await this.ctx.db.transaction(async (tx) => {
      const rows = [...kwotaLogs, ...treasuryLogs.filter((l) => l.address.toLowerCase() === token)]
        .filter((l, i, arr) => arr.findIndex((x) => x.transactionHash === l.transactionHash && x.logIndex === l.logIndex) === i)
        .map((l) => ({
          chainId: env.CHAIN_ID, token: l.address.toLowerCase(), txHash: l.transactionHash, logIndex: l.logIndex, blockNumber: l.blockNumber,
          blockHash: l.blockHash, blockTime: this.blockTimes.get(l.blockNumber)!.time, from: l.args.from.toLowerCase(), to: l.args.to.toLowerCase(), amount: l.args.value,
        }));
      for (let i = 0; i < rows.length; i += 500) await tx.insert(tables.tokenTransfers).values(rows.slice(i, i + 500)).onConflictDoNothing();

      for (const l of treasuryLogs) {
        const [inflow] = await tx
          .insert(tables.treasuryInflows)
          .values({
            chainId: env.CHAIN_ID, token: l.address.toLowerCase(), txHash: l.transactionHash, logIndex: l.logIndex, from: l.args.from.toLowerCase(),
            amount: l.args.value, blockNumber: l.blockNumber, blockTime: this.blockTimes.get(l.blockNumber)!.time,
          })
          .onConflictDoNothing()
          .returning();
        if (inflow) {
          inflowCount++;
          await insertFeeAllocations(tx, inflow.id, inflow.token, inflow.amount, p.fee_split, splitVersion);
        }
      }
      await tx
        .update(tables.indexerCursors)
        .set({ lastBlock: to, lastBlockHash: toBlock.hash, lastBlockTime: toBlock.time, updatedAt: new Date() })
        .where(eq(tables.indexerCursors.name, KWOTA_CURSOR));
    });
    if (kwotaLogs.length) {
      const touched = [...new Set(kwotaLogs.flatMap((l) => [l.args.from.toLowerCase(), l.args.to.toLowerCase()]))];
      await this.rebuildBalances(touched);
    }
    inflowCount += await this.indexNativeInflows();
    return { from, to, transfers: kwotaLogs.length, inflows: inflowCount };
  }

  /** Native ETH sent to the treasury (no logs) via Blockscout API, if configured. */
  async indexNativeInflows(): Promise<number> {
    const env = this.ctx.env;
    if (!env.BLOCKSCOUT_API_URL || !env.TREASURY_ADDRESS) return 0;
    const base = env.BLOCKSCOUT_API_URL.replace(/\/$/, "");
    let n = 0;
    const p = await this.ctx.params.all();
    for (const path of ["transactions", "internal-transactions"]) {
      let items: { hash?: string; transaction_hash?: string; index?: number; value: string; from: { hash: string }; to?: { hash: string } | null; block_number?: number; block?: number; timestamp: string; status?: string; success?: boolean }[] = [];
      try {
        const res = await fetch(`${base}/api/v2/addresses/${env.TREASURY_ADDRESS}/${path}?filter=to`);
        if (!res.ok) continue;
        items = ((await res.json()) as { items: typeof items }).items ?? [];
      } catch {
        continue;
      }
      for (const it of items) {
        if (BigInt(it.value || "0") === 0n) continue;
        if (it.to?.hash?.toLowerCase() !== env.TREASURY_ADDRESS) continue;
        if (it.status === "error" || it.success === false) continue;
        const blockNumber = BigInt(it.block_number ?? it.block ?? 0);
        const [cur] = await this.ctx.db.select().from(tables.indexerCursors).where(eq(tables.indexerCursors.name, KWOTA_CURSOR));
        if (!cur || blockNumber > cur.lastBlock) continue; // only confirmed range
        const [inflow] = await this.ctx.db
          .insert(tables.treasuryInflows)
          .values({
            chainId: env.CHAIN_ID, token: ZERO, txHash: (it.hash ?? it.transaction_hash)!, logIndex: path === "transactions" ? -1 : -(2 + (it.index ?? 0)),
            from: it.from.hash.toLowerCase(), amount: BigInt(it.value), blockNumber, blockTime: Math.floor(new Date(it.timestamp).getTime() / 1000),
          })
          .onConflictDoNothing()
          .returning();
        if (inflow) {
          n++;
          await insertFeeAllocations(this.ctx.db, inflow.id, ZERO, inflow.amount, p.fee_split, p._versions.fee_split ?? 0);
        }
      }
    }
    return n;
  }
}

export async function insertFeeAllocations(
  tx: Pick<Ctx["db"], "insert">,
  inflowId: bigint,
  token: string,
  amount: bigint,
  split: { poolBps: number; vaultBps: number; opsBps: number },
  version: number,
) {
  const s = splitAmount(amount, split);
  await tx
    .insert(tables.feeAllocations)
    .values((["pool", "vault", "ops"] as const).map((bucket) => ({ inflowId, bucket, token, amount: s[bucket], splitVersion: version })))
    .onConflictDoNothing();
}

