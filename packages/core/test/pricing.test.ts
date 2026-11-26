import { describe, expect, it } from "vitest";
import { capOutputTokens, estimateInputTokens, formatKwota, parseKwota, splitAmount, usageCostMicro, validateSplit, DEFAULT_FEE_SPLIT } from "../src";

// $3 / 1M input, $15 / 1M output
const price = { inputPriceMicroPerMTok: 3_000_000n, outputPriceMicroPerMTok: 15_000_000n, markupBps: 0 };

describe("usageCostMicro", () => {
  it("computes token cost in µkwota", () => {
    // 1000 in × $3/M = $0.003 ; 500 out × $15/M = $0.0075 → 10_500 µ
    expect(usageCostMicro(price, 1000, 500)).toBe(10_500n);
  });
  it("rounds up, never undercharges", () => {
    expect(usageCostMicro(price, 1, 0)).toBe(3n);
    expect(usageCostMicro({ ...price, inputPriceMicroPerMTok: 1n }, 1, 0)).toBe(1n);
    expect(usageCostMicro(price, 0, 0)).toBe(0n);
  });
  it("applies markup", () => {
    expect(usageCostMicro({ ...price, markupBps: 1000 }, 1000, 500)).toBe(11_550n);
  });
  it("rejects negative tokens", () => {
    expect(() => usageCostMicro(price, -1, 0)).toThrow();
  });
});

describe("capOutputTokens", () => {
  it("caps by server max and requested", () => {
    expect(capOutputTokens({ requested: 100, serverMax: 4096, price, estimatedInputTokens: 10, maxCostMicro: 10n ** 9n })).toBe(100);
    expect(capOutputTokens({ requested: 99999, serverMax: 4096, price, estimatedInputTokens: 10, maxCostMicro: 10n ** 9n })).toBe(4096);
  });
  it("caps by per-request cost limit", () => {
    // budget $0.015 minus input 10 tok ($0.00003) → floor(14970 / 15) = 998 tokens
    const n = capOutputTokens({ requested: null, serverMax: 4096, price, estimatedInputTokens: 10, maxCostMicro: 15_000n });
    expect(n).toBe(998);
    expect(usageCostMicro(price, 10, n)).toBeLessThanOrEqual(15_000n);
  });
  it("returns 0 when input alone exceeds the cap", () => {
    expect(capOutputTokens({ requested: 10, serverMax: 10, price, estimatedInputTokens: 1_000_000, maxCostMicro: 1n })).toBe(0);
  });
});

describe("estimateInputTokens", () => {
  it("is conservative and grows with content", () => {
    const small = estimateInputTokens([{ role: "user", content: "hi" }]);
    const big = estimateInputTokens([{ role: "user", content: "x".repeat(3000) }]);
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(1000);
  });
});

describe("units", () => {
  it("formats and parses", () => {
    expect(formatKwota(1_234_567n)).toBe("1.2345");
    expect(formatKwota(-500_000n, 2)).toBe("-0.50");
    expect(parseKwota("1.25")).toBe(1_250_000n);
    expect(() => parseKwota("1.1234567")).toThrow();
  });
});

describe("fee split", () => {
  it("splits exactly with remainder to ops", () => {
    const s = splitAmount(1001n, DEFAULT_FEE_SPLIT);
    expect(s).toEqual({ pool: 500n, vault: 300n, ops: 201n });
    expect(s.pool + s.vault + s.ops).toBe(1001n);
  });
  it("validates", () => {
    expect(() => validateSplit({ poolBps: 5000, vaultBps: 3000, opsBps: 1000 })).toThrow();
    expect(() => validateSplit({ poolBps: 5000.5, vaultBps: 3000, opsBps: 1999.5 })).toThrow();
  });
});
