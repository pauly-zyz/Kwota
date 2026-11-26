import { describe, expect, it } from "vitest";
import { applyTransfers, computeTwab, ZERO_ADDRESS, type TransferEvent } from "../src";

const A = "0x000000000000000000000000000000000000000a";
const B = "0x000000000000000000000000000000000000000b";
const C = "0x000000000000000000000000000000000000000c";
let li = 0;
const tx = (from: string, to: string, amount: bigint, timestamp: number, block = BigInt(timestamp)): TransferEvent => ({
  from, to, amount, timestamp, blockNumber: block, logIndex: li++,
});

describe("computeTwab", () => {
  it("holder with constant balance has twab == balance", () => {
    const r = computeTwab({ openingBalances: new Map([[A, 100n]]), transfers: [], start: 0, end: 100 });
    expect(r.get(A)!.twab).toBe(100n);
    expect(r.get(A)!.balanceSeconds).toBe(10_000n);
  });

  it("buy mid-epoch earns proportional weight", () => {
    const r = computeTwab({ openingBalances: new Map(), transfers: [tx(ZERO_ADDRESS, A, 100n, 75)], start: 0, end: 100 });
    expect(r.get(A)!.twab).toBe(25n);
    expect(r.get(A)!.opening).toBe(0n);
    expect(r.get(A)!.closing).toBe(100n);
  });

  it("buy just before close earns almost nothing (anti snapshot-sniping)", () => {
    const r = computeTwab({ openingBalances: new Map([[A, 1000n]]), transfers: [tx(B, C, 0n, 1), tx(A, B, 1000n, 86_399)], start: 0, end: 86_400 });
    expect(r.get(B)!.balanceSeconds).toBe(1000n);
    expect(r.get(B)!.twab).toBe(0n);
    expect(r.get(A)!.twab).toBe(999n);
  });

  it("tracks min balance and handles sell then rebuy", () => {
    const r = computeTwab({
      openingBalances: new Map([[A, 100n]]),
      transfers: [tx(A, B, 60n, 10), tx(B, A, 60n, 20)],
      start: 0,
      end: 40,
    });
    // A: 100×10 + 40×10 + 100×20 = 3400
    expect(r.get(A)!.balanceSeconds).toBe(3400n);
    expect(r.get(A)!.minBalance).toBe(40n);
    expect(r.get(B)!.balanceSeconds).toBe(600n);
  });

  it("orders multiple transfers in same block by logIndex", () => {
    const t1 = { ...tx(A, B, 100n, 50, 5n), logIndex: 1 };
    const t2 = { ...tx(B, C, 100n, 50, 5n), logIndex: 2 };
    const r = computeTwab({ openingBalances: new Map([[A, 100n]]), transfers: [t2, t1], start: 0, end: 100 });
    expect(r.get(B)!.balanceSeconds).toBe(0n);
    expect(r.get(C)!.balanceSeconds).toBe(5000n);
  });

  it("rejects transfers outside the epoch and negative balances", () => {
    expect(() => computeTwab({ openingBalances: new Map(), transfers: [tx(ZERO_ADDRESS, A, 1n, 100)], start: 0, end: 100 })).toThrow();
    expect(() => computeTwab({ openingBalances: new Map(), transfers: [tx(A, B, 1n, 5)], start: 0, end: 100 })).toThrow(/negative/);
  });

  it("normalises address case", () => {
    const r = computeTwab({ openingBalances: new Map([[A, 10n]]), transfers: [tx(A.toUpperCase().replace("0X", "0x"), B, 10n, 50)], start: 0, end: 100 });
    expect(r.get(A)!.balanceSeconds).toBe(500n);
  });

  it("applyTransfers rolls balances forward and drops zeros", () => {
    const next = applyTransfers(new Map([[A, 10n]]), [tx(A, B, 10n, 1), tx(ZERO_ADDRESS, C, 5n, 2)]);
    expect(next.has(A)).toBe(false);
    expect(next.get(B)).toBe(10n);
    expect(next.get(C)).toBe(5n);
  });
});
