export type Bucket = "pool" | "vault" | "ops";
export interface FeeSplit {
  poolBps: number;
  vaultBps: number;
  opsBps: number;
}

export const DEFAULT_FEE_SPLIT: FeeSplit = { poolBps: 5000, vaultBps: 3000, opsBps: 2000 };

export function validateSplit(s: FeeSplit): void {
  for (const v of [s.poolBps, s.vaultBps, s.opsBps]) {
    if (!Number.isInteger(v) || v < 0 || v > 10_000) throw new Error("split bps must be integers in [0, 10000]");
  }
  if (s.poolBps + s.vaultBps + s.opsBps !== 10_000) throw new Error("split must sum to 10000 bps");
}

/** Split a raw token amount; rounding remainder goes to ops so the sum is exact. */
export function splitAmount(amount: bigint, s: FeeSplit): Record<Bucket, bigint> {
  validateSplit(s);
  if (amount < 0n) throw new Error("negative amount");
  const pool = (amount * BigInt(s.poolBps)) / 10_000n;
  const vault = (amount * BigInt(s.vaultBps)) / 10_000n;
  return { pool, vault, ops: amount - pool - vault };
}
