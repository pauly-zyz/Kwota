import type { HolderTwab } from "./twab";

export type MinHoldingMode = "twab" | "min_balance";

export interface AllocationParams {
  budgetMicro: bigint;
  minHoldingRaw: bigint;
  minHoldingMode: MinHoldingMode;
  excluded: Set<string>;
}

export interface HolderAllocation {
  address: string;
  twab: bigint;
  balanceSeconds: bigint;
  /** parts per million of the distributed budget */
  sharePpm: number;
  kwotaMicro: bigint;
}

export interface EpochAllocationResult {
  allocations: HolderAllocation[];
  totalWeight: bigint;
  eligibleCount: number;
  distributedMicro: bigint;
  dustMicro: bigint;
}

export function isEligible(h: HolderTwab, p: AllocationParams): boolean {
  if (p.excluded.has(h.address.toLowerCase())) return false;
  if (h.balanceSeconds <= 0n) return false;
  const measure = p.minHoldingMode === "twab" ? h.twab : h.minBalance;
  return measure >= p.minHoldingRaw;
}

/**
 * Pro-rata allocation by balance-seconds (equivalent to TWAB weight, without the
 * rounding loss of the per-holder division). Deterministic: sorted by address,
 * every amount floored, the remainder (dust) is carried to the next epoch.
 */
export function allocateEpoch(
  twabs: Iterable<HolderTwab>,
  p: AllocationParams,
): EpochAllocationResult {
  if (p.budgetMicro < 0n) throw new Error("negative budget");
  const eligible = [...twabs]
    .filter((h) => isEligible(h, p))
    .sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));
  const totalWeight = eligible.reduce((s, h) => s + h.balanceSeconds, 0n);
  if (totalWeight === 0n) {
    return { allocations: [], totalWeight: 0n, eligibleCount: 0, distributedMicro: 0n, dustMicro: p.budgetMicro };
  }
  let distributed = 0n;
  const allocations = eligible.map((h) => {
    const kwotaMicro = (p.budgetMicro * h.balanceSeconds) / totalWeight;
    distributed += kwotaMicro;
    return {
      address: h.address,
      twab: h.twab,
      balanceSeconds: h.balanceSeconds,
      sharePpm: Number((h.balanceSeconds * 1_000_000n) / totalWeight),
      kwotaMicro,
    };
  });
  return {
    allocations,
    totalWeight,
    eligibleCount: eligible.length,
    distributedMicro: distributed,
    dustMicro: p.budgetMicro - distributed,
  };
}

export interface BudgetPolicy {
  /** share of unallocated realized pool funds distributed each epoch (bps) */
  distributeBps: number;
}

/** budget = floor((unallocatedPool) × distributeBps / 10000) + carried dust */
export function epochBudget(unallocatedPoolMicro: bigint, dustInMicro: bigint, policy: BudgetPolicy): bigint {
  if (policy.distributeBps < 0 || policy.distributeBps > 10_000) throw new Error("distributeBps out of range");
  const base = unallocatedPoolMicro > 0n ? (unallocatedPoolMicro * BigInt(policy.distributeBps)) / 10_000n : 0n;
  return base + dustInMicro;
}
