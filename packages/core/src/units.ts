/** 1 kwota = 1 USD of AI usage = 1_000_000 µkwota. All money math uses bigint µkwota. */
export const MICRO = 1_000_000n;

export function formatKwota(micro: bigint, decimals = 4): string {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const whole = abs / MICRO;
  const frac = (abs % MICRO).toString().padStart(6, "0").slice(0, decimals);
  return `${neg ? "-" : ""}${whole.toString()}${decimals > 0 ? "." + frac : ""}`;
}

/** Parse a decimal string ("1.25") into µkwota. Throws on invalid input. */
export function parseKwota(value: string): bigint {
  const s = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new Error(`invalid kwota amount: ${value}`);
  const [w, f = ""] = s.split(".");
  return BigInt(w!) * MICRO + BigInt(f.padEnd(6, "0"));
}

/** Integer ceil division for non-negative bigints. */
export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new Error("division by non-positive");
  if (a <= 0n) return 0n;
  return (a + b - 1n) / b;
}

export function utcDay(ts: Date | number): string {
  const d = typeof ts === "number" ? new Date(ts) : ts;
  return d.toISOString().slice(0, 10);
}
