import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type PublicClient } from "viem";
import { ADMIN_ACTION_TYPES, adminDomain } from "@kwota/core";
import { tables } from "@kwota/db";
import { verifyAndRecordSwap, toMicro } from "../src/admin/swaps";
import { Indexer, TRANSFER_EVENT } from "../src/indexer/indexer";
import { admin, holder, login, OPS, POOL, TOKEN, TREASURY, USDG, VAULT, setup } from "./helpers";

let s: Awaited<ReturnType<typeof setup>>;
let adminSession: string;
let n = 0;

beforeAll(async () => {
  s = await setup();
  adminSession = await login(s.app, admin);
});
afterAll(async () => {
  await s.app.close();
  await s.ctx.close();
});

async function signedAction(action: string, payload: unknown, opts: { nonce?: string; signer?: typeof admin } = {}) {
  const p = JSON.stringify(payload);
  const nonce = opts.nonce ?? `n-${n++}-${Date.now()}`;
  const issuedAt = Math.floor(Date.now() / 1000);
  const signature = await (opts.signer ?? admin).signTypedData({
    domain: adminDomain(46630), types: ADMIN_ACTION_TYPES, primaryType: "AdminAction",
    message: { action, payload: p, nonce, issuedAt: BigInt(issuedAt) },
  });
  return { action, payload: p, nonce, issuedAt, signature };
}

const post = (url: string, body: unknown, token = adminSession) => s.app.inject({ method: "POST", url, headers: { authorization: `Bearer ${token}` }, payload: body as never });

describe("admin auth", () => {
  it("non-admins are rejected", async () => {
    const t = await login(s.app, holder);
    expect((await s.app.inject({ method: "GET", url: "/admin/state", headers: { authorization: `Bearer ${t}` } })).statusCode).toBe(403);
  });

  it("unsigned mutations are rejected", async () => {
    expect((await post("/admin/params", { fee_split: { poolBps: 1, vaultBps: 1, opsBps: 9998 } })).statusCode).toBe(401);
  });

  it("signed param change is applied, versioned and audited", async () => {
    const body = await signedAction("set_params", { fee_split: { poolBps: 6000, vaultBps: 3000, opsBps: 1000 }, epoch_seconds: 43200 });
    const res = await post("/admin/params", body);
    expect(res.statusCode).toBe(200);
    const p = await s.ctx.params.all();
    expect(p.fee_split.poolBps).toBe(6000);
    expect(p.epoch_seconds).toBe(43200);
    const state = (await s.app.inject({ method: "GET", url: "/admin/state", headers: { authorization: `Bearer ${adminSession}` } })).json();
    expect(state.audit[0].action).toBe("set_params");
    expect(state.audit[0].signature).toBe(body.signature);
  });

  it("invalid split and nonce reuse are rejected", async () => {
    expect((await post("/admin/params", await signedAction("set_params", { fee_split: { poolBps: 6000, vaultBps: 3000, opsBps: 2000 } }))).statusCode).toBe(400);
    const body = await signedAction("add_exclusion", { address: "0x00000000000000000000000000000000000bad01", reason: "blacklist" }, { nonce: "fixed" });
    expect((await post("/admin/exclusions", body)).statusCode).toBe(200);
    expect((await post("/admin/exclusions", body)).statusCode).toBe(401);
  });

  it("adjust_balance is refused unless enabled", async () => {
    const res = await post("/admin/adjust", await signedAction("adjust_balance", { address: holder.address, amount: "5", note: "tester credit" }));
    expect(res.statusCode).toBe(400);
  });

  it("action name is bound to the signature", async () => {
    const body = await signedAction("add_exclusion", { address: "0x00000000000000000000000000000000000bad02", reason: "blacklist" });
    expect((await post("/admin/params", body)).statusCode).toBe(401);
  });
});

// ── fake chain client for swap verification & indexer
function transferLog(token: string, from: string, to: string, value: bigint, block: bigint, logIndex: number, tx: string) {
  return {
    address: token as `0x${string}`,
    topics: encodeEventTopics({ abi: [TRANSFER_EVENT], eventName: "Transfer", args: { from: from as `0x${string}`, to: to as `0x${string}` } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
    blockNumber: block, blockHash: `0x${block.toString(16).padStart(64, "0")}`, logIndex, transactionHash: tx as `0x${string}`,
    args: { from, to, value }, removed: false, transactionIndex: 0,
  };
}

describe("swap verification", () => {
  const tx = `0x${"1".repeat(64)}` as `0x${string}`;
  const client = {
    getTransactionReceipt: async ({ hash }: { hash: string }) =>
      hash === tx
        ? { status: "success", from: TREASURY, logs: [transferLog("0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373", TREASURY, "0x00000000000000000000000000000000000d0e01", 5n * 10n ** 18n, 5n, 0, tx), transferLog(USDG, "0x00000000000000000000000000000000000d0e01", POOL, 12_340_000n, 5n, 1, tx)] }
        : hash === `0x${"2".repeat(64)}`
          ? { status: "success", from: "0x0000000000000000000000000000000000001234", logs: [] }
          : null,
    readContract: async () => 6,
  } as unknown as PublicClient;

  it("credits realized stablecoin to the pool", async () => {
    const row = await verifyAndRecordSwap(s.ctx, { txHash: tx, bucket: "pool", actor: admin.address, client });
    expect(row.poolCreditMicro).toBe(12_340_000n);
    expect(row.fromToken).toBe("0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373");
    await expect(verifyAndRecordSwap(s.ctx, { txHash: tx, bucket: "pool", actor: admin.address, client })).rejects.toThrow(/already/);
  });

  it("rejects txs from unmanaged wallets or without delivery", async () => {
    await expect(verifyAndRecordSwap(s.ctx, { txHash: `0x${"2".repeat(64)}`, bucket: "pool", actor: "x", client })).rejects.toThrow(/managed/);
    await expect(verifyAndRecordSwap(s.ctx, { txHash: `0x${"3".repeat(64)}`, bucket: "vault", actor: "x", client })).rejects.toThrow(/not found/);
  });

  it("normalises decimals", () => {
    expect(toMicro(1_500_000_000_000_000_000n, 18)).toBe(1_500_000n);
    expect(toMicro(15n, 1)).toBe(1_500_000n);
  });
});

describe("indexer", () => {
  it("indexes KWOTA transfers and treasury fee inflows with the configured split", async () => {
    const s2 = await setup({ TRACKED_FEE_TOKENS: `${TOKEN},${USDG}`, CONFIRMATIONS: "0", INDEXER_START_BLOCK: "1" });
    const logsKwota = [
      transferLog(TOKEN, "0x0000000000000000000000000000000000000000", TREASURY, 1000n, 2n, 0, `0x${"a".repeat(64)}`),
      transferLog(TOKEN, TREASURY, holder.address.toLowerCase(), 400n, 3n, 0, `0x${"b".repeat(64)}`),
    ];
    const logsTreasury = [transferLog(USDG, "0x0000000000000000000000000000000000000777", TREASURY, 1_000_000n, 3n, 1, `0x${"b".repeat(64)}`)];
    const fake = {
      getBlockNumber: async () => 5n,
      getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: 1_000n + blockNumber * 2n, hash: `0x${blockNumber.toString(16).padStart(64, "0")}` }),
      getLogs: async (q: { address: string | string[]; args?: unknown }) => (q.args ? logsTreasury.concat(logsKwota.filter((l) => l.args.to === TREASURY)) : logsKwota),
    } as unknown as PublicClient;
    const idx = new Indexer(s2.ctx, fake);
    const r = await idx.tick();
    expect(r!.transfers).toBe(2);
    const balances = await s2.ctx.db.select().from(tables.holderBalances);
    const byAddr = Object.fromEntries(balances.map((b) => [b.address, b.balance]));
    expect(byAddr[TREASURY]).toBe(600n);
    expect(byAddr[holder.address.toLowerCase()]).toBe(400n);
    const allocs = await s2.ctx.db.select().from(tables.feeAllocations);
    const usdg = allocs.filter((a) => a.token === USDG);
    expect(usdg.find((a) => a.bucket === "pool")!.amount).toBe(500_000n);
    expect(usdg.find((a) => a.bucket === "vault")!.amount).toBe(300_000n);
    expect(usdg.find((a) => a.bucket === "ops")!.amount).toBe(200_000n);
    expect(await idx.tick()).toBeNull(); // caught up
    // reorg: block hash changes → rollback
    (fake as unknown as { getBlock: unknown }).getBlock = async ({ blockNumber }: { blockNumber: bigint }) => ({ timestamp: 1_000n + blockNumber * 2n, hash: `0x${"9".repeat(63)}${blockNumber.toString(16)}` });
    const rb = await idx.tick();
    expect(rb!.from).toBe(0n);
    expect((await s2.ctx.db.select().from(tables.tokenTransfers)).length).toBe(0);
    await s2.app.close();
    await s2.ctx.close();
  });
});

void OPS;
void VAULT;
