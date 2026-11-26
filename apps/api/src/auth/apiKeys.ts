import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** API key format: kw_live_<prefix 10 hex>_<secret 40 hex>. Only sha256(secret) is stored. */
export function generateApiKey() {
  const prefix = randomBytes(5).toString("hex");
  const secret = randomBytes(20).toString("hex");
  return { key: `kw_live_${prefix}_${secret}`, prefix, secretHash: hashSecret(secret) };
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function parseApiKey(key: string): { prefix: string; secret: string } | null {
  const m = /^kw_live_([0-9a-f]{10})_([0-9a-f]{40})$/.exec(key);
  return m ? { prefix: m[1]!, secret: m[2]! } : null;
}

export function secretMatches(secret: string, storedHash: string) {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
