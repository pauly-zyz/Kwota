import { describe, expect, it } from "vitest";
import { allocateEpoch, computeTwab, epochBudget, ZERO_ADDRESS } from "../src";

const A = "0x000000000000000000000000000000000000000a";
const B = "0x000000000000000000000000000000000000000b";
const LP = "0x00000000000000000000000000000000000000ff";
const TREASURY = "0x00000000000000000000000000000000000000ee";

const base = {
  budgetMicro: 1_000_000_000n,
  minHoldingRaw: 0n,
  minHoldingMode: "twab" as const,
  excluded: new Set<string>(),
};

describe("allocateEpoch", () => {
  const twabs = computeTwab({
    openingBalances: new Map([[A, 300n], [B, 100n], [LP, 10_000n], [TREASURY, 5000n]]),
    transfers: [],
    start: 0,
    end: 100,
  });

  it("splits pro-rata by time-weighted balance", () => {
    const r = allocateEpoch(twabs.values(), { ...base, excluded: new Set([LP, TREASURY]) });
    const byAddr = Object.fromEntries(r.allocations.map((a) => [a.address, a.kwotaMicro]));
    expect(byAddr[A]).toBe(750_000_000n);
    expect(byAddr[B]).toBe(250_000_000n);
    expect(r.eligibleCount).toBe(2);
    expect(r.dustMicro).toBe(0n);
  });

  it("excluded addresses (LP, treasury, blacklist) get nothing and do not dilute", () => {
    const r = allocateEpoch(twabs.values(), { ...base, excluded: new Set([LP, TREASURY, B]) });
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0]!.kwotaMicro).toBe(base.budgetMicro);
  });

  it("minimum holding (twab mode) filters small holders", () => {
    const r = allocateEpoch(twabs.values(), { ...base, minHoldingRaw: 200n, excluded: new Set([LP, TREASURY]) });
    expect(r.allocations.map((a) => a.address)).toEqual([A]);
  });

  it("min_balance mode requires balance to never dip below minimum", () => {
    const t = computeTwab({
      openingBalances: new Map([[A, 1000n]]),
      transfers: [
        { from: A, to: B, amount: 990n, timestamp: 50, blockNumber: 1n, logIndex: 0 },
        { from: B, to: A, amount: 990n, timestamp: 51, blockNumber: 2n, logIndex: 0 },
      ],
      start: 0,
      end: 100,
    });
    const twabMode = allocateEpoch(t.values(), { ...base, minHoldingRaw: 500n });
    const strict = allocateEpoch(t.values(), { ...base, minHoldingRaw: 500n, minHoldingMode: "min_balance" });
    expect(twabMode.allocations.map((a) => a.address)).toEqual([A]);
    expect(strict.allocations).toHaveLength(0);
    expect(strict.dustMicro).toBe(base.budgetMicro);
  });

  it("floors amounts and reports dust; sum never exceeds budget", () => {
    const t = computeTwab({
      openingBalances: new Map([[A, 1n], [B, 1n], ["0x000000000000000000000000000000000000000c", 1n]]),
      transfers: [],
      start: 0,
      end: 10,
    });
    const r = allocateEpoch(t.values(), { ...base, budgetMicro: 100n });
    expect(r.allocations.every((a) => a.kwotaMicro === 33n)).toBe(true);
    expect(r.distributedMicro + r.dustMicro).toBe(100n);
    expect(r.dustMicro).toBe(1n);
  });

  it("is deterministic regardless of input order", () => {
    const list = [...twabs.values()];
    const r1 = allocateEpoch(list, base);
    const r2 = allocateEpoch([...list].reverse(), base);
    expect(r1).toEqual(r2);
  });

  it("ignores mint-from-zero as a holder", () => {
    const t = computeTwab({ openingBalances: new Map(), transfers: [{ from: ZERO_ADDRESS, to: A, amount: 5n, timestamp: 0, blockNumber: 1n, logIndex: 0 }], start: 0, end: 10 });
    expect(t.has(ZERO_ADDRESS)).toBe(false);
  });
});

describe("epochBudget", () => {
  it("distributes configured share plus carried dust", () => {
    expect(epochBudget(1_000_000n, 7n, { distributeBps: 9000 })).toBe(900_007n);
    expect(epochBudget(-5n, 3n, { distributeBps: 9000 })).toBe(3n);
    expect(() => epochBudget(1n, 0n, { distributeBps: 10_001 })).toThrow();
  });
});
