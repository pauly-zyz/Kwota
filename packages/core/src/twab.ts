/**
 * Exact time-weighted average balance (TWAB) from Transfer events.
 *
 *   balanceSeconds_i = Σ_k balance_i(segment k) × duration(segment k)   over [start, end)
 *   twab_i           = floor(balanceSeconds_i / (end − start))
 *
 * Segments are delimited by every Transfer touching address i inside the epoch,
 * using block timestamps (seconds). Buying 1 minute before the epoch closes
 * therefore earns ~1 minute worth of weight.
 */
export interface TransferEvent {
  from: string;
  to: string;
  amount: bigint;
  /** block timestamp, unix seconds */
  timestamp: number;
  blockNumber: bigint;
  logIndex: number;
}

export interface TwabInput {
  /** balances at `start` (before any transfer at timestamp >= start) */
  openingBalances: Map<string, bigint>;
  /** transfers with start <= timestamp < end, any order */
  transfers: TransferEvent[];
  start: number;
  end: number;
}

export interface HolderTwab {
  address: string;
  opening: bigint;
  closing: bigint;
  minBalance: bigint;
  balanceSeconds: bigint;
  twab: bigint;
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function sortTransfers(transfers: TransferEvent[]): TransferEvent[] {
  return [...transfers].sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? a.logIndex - b.logIndex
      : a.blockNumber < b.blockNumber
        ? -1
        : 1,
  );
}

export function computeTwab(input: TwabInput): Map<string, HolderTwab> {
  const { start, end } = input;
  if (!(end > start)) throw new Error("epoch end must be after start");
  const duration = BigInt(end - start);

  const state = new Map<
    string,
    { opening: bigint; bal: bigint; min: bigint; acc: bigint; lastTs: number }
  >();
  const touch = (addr: string) => {
    const a = addr.toLowerCase();
    let s = state.get(a);
    if (!s) {
      const o = input.openingBalances.get(a) ?? 0n;
      s = { opening: o, bal: o, min: o, acc: 0n, lastTs: start };
      state.set(a, s);
    }
    return s;
  };

  for (const [addr] of input.openingBalances) touch(addr);

  for (const t of sortTransfers(input.transfers)) {
    if (t.timestamp < start || t.timestamp >= end) {
      throw new Error(`transfer at ${t.timestamp} outside epoch [${start}, ${end})`);
    }
    if (t.amount === 0n) continue;
    for (const [addr, sign] of [
      [t.from, -1n],
      [t.to, 1n],
    ] as const) {
      if (addr.toLowerCase() === ZERO_ADDRESS) continue; // mint/burn counterpart
      const s = touch(addr);
      s.acc += s.bal * BigInt(t.timestamp - s.lastTs);
      s.lastTs = t.timestamp;
      s.bal += sign * t.amount;
      if (s.bal < 0n) throw new Error(`negative balance for ${addr} at block ${t.blockNumber}`);
      if (s.bal < s.min) s.min = s.bal;
    }
  }

  const out = new Map<string, HolderTwab>();
  for (const [address, s] of state) {
    const acc = s.acc + s.bal * BigInt(end - s.lastTs);
    out.set(address, {
      address,
      opening: s.opening,
      closing: s.bal,
      minBalance: s.min,
      balanceSeconds: acc,
      twab: acc / duration,
    });
  }
  return out;
}

/** Apply transfers to a balance map (used to roll opening balances forward). */
export function applyTransfers(
  balances: Map<string, bigint>,
  transfers: TransferEvent[],
): Map<string, bigint> {
  const next = new Map(balances);
  for (const t of sortTransfers(transfers)) {
    const from = t.from.toLowerCase();
    const to = t.to.toLowerCase();
    if (from !== ZERO_ADDRESS) next.set(from, (next.get(from) ?? 0n) - t.amount);
    if (to !== ZERO_ADDRESS) next.set(to, (next.get(to) ?? 0n) + t.amount);
  }
  for (const [k, v] of next) if (v === 0n) next.delete(k);
  return next;
}
