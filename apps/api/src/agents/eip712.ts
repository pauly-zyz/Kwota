import { keccak256, verifyTypedData, type PublicClient } from "viem";
import { AGENT_HEADERS, AGENT_REQUEST_TYPES, MAX_AGENT_EXPIRY_SECONDS, agentDomain } from "@kwota/core";
import type { Kv } from "../lib/kv";
import { unauthorized } from "../lib/errors";

export interface SignedAgentHeaders {
  agentId: bigint;
  registry: `0x${string}`;
  nonce: bigint;
  expiry: bigint;
  signature: `0x${string}`;
}

export function readAgentHeaders(h: Record<string, string | string[] | undefined>): SignedAgentHeaders | null {
  const g = (k: string) => {
    const v = h[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const sig = g(AGENT_HEADERS.signature);
  if (!sig) return null;
  const agentId = g(AGENT_HEADERS.agentId);
  const registry = g(AGENT_HEADERS.registry);
  const nonce = g(AGENT_HEADERS.nonce);
  const expiry = g(AGENT_HEADERS.expiry);
  if (!agentId || !registry || !nonce || !expiry) throw unauthorized("missing agent signature headers");
  if (!/^\d{1,78}$/.test(agentId) || !/^\d{1,78}$/.test(nonce) || !/^\d{1,20}$/.test(expiry)) throw unauthorized("malformed agent headers");
  if (!/^0x[0-9a-fA-F]{40}$/.test(registry) || !/^0x[0-9a-fA-F]+$/.test(sig)) throw unauthorized("malformed agent headers");
  return {
    agentId: BigInt(agentId),
    registry: registry.toLowerCase() as `0x${string}`,
    nonce: BigInt(nonce),
    expiry: BigInt(expiry),
    signature: sig as `0x${string}`,
  };
}

/**
 * Verify an EIP-712 signed agent request:
 *  - expiry in the future and at most MAX_AGENT_EXPIRY_SECONDS ahead
 *  - bodyHash == keccak256(raw body)
 *  - signer == agent wallet (ERC-1271 supported when a client is given)
 *  - nonce unused (stored until expiry → replay protection)
 */
export async function verifyAgentRequest(opts: {
  headers: SignedAgentHeaders;
  rawBody: string;
  chainId: number;
  expectedSigner: `0x${string}`;
  kv: Kv;
  client?: PublicClient | null;
  now?: number;
}) {
  const now = BigInt(opts.now ?? Math.floor(Date.now() / 1000));
  const h = opts.headers;
  if (h.expiry <= now) throw unauthorized("signature expired", "signature_expired");
  if (h.expiry > now + BigInt(MAX_AGENT_EXPIRY_SECONDS)) throw unauthorized("expiry too far in the future");
  const bodyHash = keccak256(new TextEncoder().encode(opts.rawBody));
  const params = {
    address: opts.expectedSigner,
    domain: agentDomain(opts.chainId, h.registry),
    types: AGENT_REQUEST_TYPES,
    primaryType: "KwotaRequest" as const,
    message: { agentId: h.agentId, bodyHash, nonce: h.nonce, expiry: h.expiry },
    signature: h.signature,
  };
  let ok = false;
  try {
    ok = opts.client ? await opts.client.verifyTypedData(params) : await verifyTypedData(params);
  } catch {
    ok = false;
  }
  if (!ok) throw unauthorized("bad agent signature", "bad_signature");
  const ttl = Number(h.expiry - now) + 5;
  const fresh = await opts.kv.setNx(`agent:nonce:${h.registry}:${h.agentId}:${h.nonce}`, "1", ttl);
  if (!fresh) throw unauthorized("nonce already used", "replay");
  return { nonce: h.nonce.toString() };
}
