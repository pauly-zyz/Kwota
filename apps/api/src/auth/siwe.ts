import { randomBytes } from "node:crypto";
import { createSiweMessage, parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { verifyMessage, type PublicClient } from "viem";
import type { Kv } from "../lib/kv";
import { unauthorized } from "../lib/errors";

export async function issueNonce(kv: Kv): Promise<string> {
  const nonce = randomBytes(12).toString("hex");
  await kv.set(`siwe:nonce:${nonce}`, "1", 600);
  return nonce;
}

export { createSiweMessage };

/**
 * Verify an EIP-4361 message. With a public client, smart-account (ERC-1271 /
 * ERC-6492) signatures are supported; otherwise EOA only.
 */
export async function verifySiwe(opts: {
  kv: Kv;
  message: string;
  signature: `0x${string}`;
  domain: string[];
  chainId: number;
  client?: PublicClient | null;
}): Promise<string> {
  const parsed = parseSiweMessage(opts.message);
  if (!parsed.address || !parsed.nonce) throw unauthorized("malformed SIWE message");
  if (parsed.chainId !== opts.chainId) throw unauthorized("wrong chain");
  if (opts.domain.length && !opts.domain.includes(parsed.domain ?? "")) throw unauthorized("domain not allowed");
  if (!validateSiweMessage({ message: parsed })) throw unauthorized("SIWE message expired or not yet valid");
  const fresh = await opts.kv.get(`siwe:nonce:${parsed.nonce}`);
  if (!fresh) throw unauthorized("unknown or used nonce");
  await opts.kv.del(`siwe:nonce:${parsed.nonce}`);
  let ok = false;
  try {
    ok = opts.client
      ? await opts.client.verifyMessage({ address: parsed.address, message: opts.message, signature: opts.signature })
      : await verifyMessage({ address: parsed.address, message: opts.message, signature: opts.signature });
  } catch {
    ok = false;
  }
  if (!ok) throw unauthorized("bad signature");
  return parsed.address.toLowerCase();
}
