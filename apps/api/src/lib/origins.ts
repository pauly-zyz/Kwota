/**
 * Origin allow-list with optional "*" wildcards inside the host, e.g.
 * "https://kwota*.vercel.app". Used for CORS and SIWE domain binding.
 */
export function parseOrigins(csv: string): string[] {
  return csv.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
}

const toRegex = (pattern: string) =>
  new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]*") + "$", "i");

export function originAllowed(patterns: string[], origin: string): boolean {
  return patterns.some((p) => p === "*" || toRegex(p).test(origin));
}

/** SIWE `domain` is host[:port]; match it against the host part of each pattern. */
export function domainAllowed(patterns: string[], domain: string): boolean {
  return patterns.some((p) => p !== "*" && toRegex(p.replace(/^https?:\/\//, "")).test(domain));
}
