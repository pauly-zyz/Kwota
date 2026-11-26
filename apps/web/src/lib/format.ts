import { formatUnits } from "viem";

export function kwota(micro: string | bigint | number | null | undefined, digits = 2): string {
  if (micro === null || micro === undefined) return "—";
  const n = Number(BigInt(micro)) / 1e6;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, n < 1 && n > 0 ? 4 : digits) });
}

export function usd(micro: string | bigint | null | undefined, digits = 2) {
  if (micro === null || micro === undefined) return "—";
  return "$" + kwota(micro, digits);
}

export function token(raw: string | bigint | null | undefined, decimals = 18, digits = 2) {
  if (raw === null || raw === undefined) return "—";
  const n = Number(formatUnits(BigInt(raw), decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export const short = (a?: string | null, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "—");

export function dateTime(v: string | number | Date | null | undefined) {
  if (v === null || v === undefined) return "—";
  const d = typeof v === "number" ? new Date(v * 1000) : new Date(v);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function countdown(endUnix: number) {
  const s = Math.max(0, endUnix - Math.floor(Date.now() / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function bps(v: number) {
  return `${(v / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
