import { createHmac, timingSafeEqual } from "node:crypto";

/** Stateless HMAC session token: kws_<base64url(payload)>.<base64url(sig)> */
export interface SessionPayload {
  address: string;
  iat: number;
  exp: number;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signSession(secret: string, address: string, ttlSec = 7 * 86_400): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64(JSON.stringify({ address: address.toLowerCase(), iat: now, exp: now + ttlSec }));
  const sig = b64(createHmac("sha256", secret).update(payload).digest());
  return `kws_${payload}.${sig}`;
}

export function verifySession(secret: string, token: string): SessionPayload | null {
  if (!token.startsWith("kws_")) return null;
  const [payload, sig] = token.slice(4).split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (typeof p.address !== "string" || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}
