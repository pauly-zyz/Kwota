import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { tables } from "@kwota/db";
import { epochRoot } from "@kwota/core";
import { EpochEngine, KWOTA_CURSOR } from "../src/epoch/engine";
import { LP, TOKEN, TREASURY, setup } from "./helpers";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";
const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86_400;
const G = 1_700_000_000 - (1_700_000_000 % DAY); // genesis aligned

let s: Awaited<ReturnType<typeof setup>>;
let engine: EpochEngine;
let li = 0;

async function transfer(from: string, to: string, amount: bigint, time: number, block: bigint) {
  await s.ctx.db.insert(tables.tokenTransfers).values({
    chainId: 46630, token: TOKEN, txHash: `0x${(li + 1).toString(16).padStart(64, "0")}`, logIndex: li++, blockNumber: block,
    blockHash: `0x${"ab".repeat(32)}`, blockTime: time, from, to, amount,
  });
}

async function poolSwap(micro: bigint, n: number) {
  await s.ctx.db.insert(tables.swaps).values({
    bucket: "pool", txHash: `0x${n.toString(16).padStart(64, "f")}`, toToken: "0x00000000000000000000000000000000000005d1", toAmount: micro,
    toAddress: "0x00000000000000000000000000000000000000e2", poolCreditMicro: micro, recordedBy: "test", verified: true,
  });
}

async function setCursor(time: number, block: bigint) {
  await s.ctx.db
    .insert(tables.indexerCursors)
    .values({ name: KWOTA_CURSOR, chainId: 46630, lastBlock: block, lastBlockHash: "0x", lastBlockTime: time })
    .onConflictDoUpdate({ target: tables.indexerCursors.name, set: { lastBlock: block, lastBlockTime: time } });
}

beforeAll(async () => {
  s = await setup({ EPOCH_GENESIS_TIME: String(G) });
  engine = new EpochEngine(s.ctx);
  await s.ctx.params.set("kwota_expiry_epochs", 2, "test", null);
  // pre-genesis distribution
  await transfer(ZERO, TREASURY, 1_000_000n, G - 100, 1n);
  await transfer(TREASURY, LP, 500_000n, G - 90, 2n);
  await transfer(TREASURY, A, 300n, G - 80, 3n);
  await transfer(TREASURY, B, 100n, G - 70, 4n);
  // during epoch 1: C buys half-way, B sells everything at 3/4
  await transfer(LP, C, 200n, G + DAY / 2, 10n);
  await transfer(B, LP, 100n, G + (3 * DAY) / 4, 11n);
  await poolSwap(10_000_000n, 1); // $10 realized in pool
});
afterAll(async () => {
  await s.app.close();
  await s.ctx.close();
});

describe("epoch engine", () => {
  it("creates the schedule from genesis", async () => {
    const e = await engine.ensureSchedule(G + 10);
    expect(e.id).toBe(1);
    expect(e.startTime).toBe(G);
    expect(e.endTime).toBe(G + DAY);
  });

  it("refuses to compute before the indexer covers the epoch", async () => {
    await setCursor(G + DAY - 1, 11n);
    await expect(engine.compute(1)).rejects.toThrow(/indexer/);
  });

  it("computes time-weighted allocations excluding LP/treasury", async () => {
    await setCursor(G + DAY + 5, 12n);
    await engine.ensureSchedule(G + DAY + 5);
    const r = await engine.compute(1);
    // budget = 90% of $10
    expect(r.budget).toBe(9_000_000n);
    const by = Object.fromEntries(r.allocations.map((a) => [a.address, a]));
    expect(by[LP]).toBeUndefined();
    expect(by[TREASURY]).toBeUndefined();
    // weights: A 300×D, B 100×0.75D, C 200×0.5D  → 300 : 75 : 100
    expect(by[A]!.kwotaMicro).toBe((9_000_000n * 300n) / 475n);
    expect(by[B]!.kwotaMicro).toBe((9_000_000n * 75n) / 475n);
    expect(by[C]!.kwotaMicro).toBe((9_000_000n * 100n) / 475n);
    expect(r.distributedMicro + r.dustMicro).toBe(9_000_000n);
    expect(r.root).toBe(epochRoot(1, r.allocations));
  });

  it("publishes the snapshot + proof publicly", async () => {
    const meta = (await s.app.inject({ method: "GET", url: "/public/epochs/1" })).json();
    expect(meta.merkleRoot).toMatch(/^0x[0-9a-f]{64}$/);
    const snap = await s.app.inject({ method: "GET", url: "/public/epochs/1/snapshot" });
    expect(JSON.parse(snap.body).allocations).toHaveLength(3);
    const proof = (await s.app.inject({ method: "GET", url: `/public/epochs/1/proof/${A}` })).json();
    expect(proof.root).toBe(meta.merkleRoot);
    expect(proof.proof.length).toBeGreaterThan(0);
  });

  it("minimum holding excludes small holders on recompute", async () => {
    await s.ctx.params.set("min_holding_raw", "150", "test", null);
    const r = await engine.compute(1);
    expect(r.allocations.map((a) => a.address).sort()).toEqual([A]); // B twab 75, C twab 100
    await s.ctx.params.set("min_holding_raw", "0", "test", null);
    await engine.compute(1);
  });

  it("publish credits the ledger exactly once", async () => {
    await engine.publish(1, "test");
    await expect(engine.publish(1, "test")).rejects.toThrow();
    const u = await s.ctx.ledger.ensureUser(A);
    const acc = await s.ctx.ledger.holderAccount(u.id);
    expect(acc.balanceMicro).toBe((9_000_000n * 300n) / 475n);
    const e = await engine.get(1);
    expect(e!.status).toBe("published");
    expect(await s.ctx.ledger.reconcile()).toEqual([]);
  });

  it("carries dust and only distributes unallocated pool funds", async () => {
    await setCursor(G + 2 * DAY + 5, 13n);
    await engine.ensureSchedule(G + 2 * DAY + 5);
    const e1 = (await engine.get(1))!;
    const r = await engine.compute(2);
    const unallocated = 10_000_000n - e1.distributedMicro;
    expect(r.budget).toBe((unallocated * 9000n) / 10_000n + e1.dustOutMicro);
    await engine.publish(2, "test");
  });

  it("expires kwota older than N epochs back to the pool", async () => {
    await setCursor(G + 3 * DAY + 5, 14n);
    await engine.ensureSchedule(G + 3 * DAY + 5);
    const u = await s.ctx.ledger.ensureUser(A);
    const acc = await s.ctx.ledger.holderAccount(u.id);
    const [ep1] = await s.ctx.db.select().from(tables.epochAllocations).where(eq(tables.epochAllocations.epochId, 1));
    expect(ep1).toBeDefined();
    const before = (await s.ctx.ledger.balance(acc.id))!.balanceMicro;
    await engine.compute(3);
    await engine.publish(3, "test"); // expiry window = epochs 2..3 → epoch-1 credit expires
    const after = (await s.ctx.ledger.balance(acc.id))!.balanceMicro;
    const a1 = (await s.ctx.db.select().from(tables.epochAllocations).where(eq(tables.epochAllocations.epochId, 1))).find((x) => x.address.trim() === A)!;
    const a3 = (await s.ctx.db.select().from(tables.epochAllocations).where(eq(tables.epochAllocations.epochId, 3))).find((x) => x.address.trim() === A)!;
    expect(after).toBe(before - a1.kwotaMicro + a3.kwotaMicro);
    const overview = (await s.app.inject({ method: "GET", url: "/public/overview" })).json();
    expect(BigInt(overview.pool.expiredMicro)).toBeGreaterThan(0n);
    expect(await s.ctx.ledger.reconcile()).toEqual([]);
  });

  it("live estimate for the open epoch", async () => {
    const est = await engine.estimate(A, G + 3 * DAY + DAY / 2);
    expect(est.epochId).toBe(4);
    expect(est.sharePpm).toBeGreaterThan(0);
  });
});
