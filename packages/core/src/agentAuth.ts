/** EIP-712 typed data for signed agent requests to the gateway. */
export const AGENT_REQUEST_TYPES = {
  KwotaRequest: [
    { name: "agentId", type: "uint256" },
    { name: "bodyHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint64" },
  ],
} as const;

export const AGENT_DOMAIN_NAME = "KWOTA Gateway";
export const AGENT_DOMAIN_VERSION = "1";
/** Maximum allowed distance between now and expiry (seconds). */
export const MAX_AGENT_EXPIRY_SECONDS = 300;

export function agentDomain(chainId: number, verifyingContract: `0x${string}`) {
  return { name: AGENT_DOMAIN_NAME, version: AGENT_DOMAIN_VERSION, chainId, verifyingContract } as const;
}

export interface AgentRequestMessage {
  agentId: bigint;
  bodyHash: `0x${string}`;
  nonce: bigint;
  expiry: bigint;
}

export const AGENT_HEADERS = {
  agentId: "x-kwota-agent",
  registry: "x-kwota-registry",
  nonce: "x-kwota-nonce",
  expiry: "x-kwota-expiry",
  signature: "x-kwota-signature",
} as const;

/** Admin parameter-change typed data: every admin change must be signed by an admin wallet. */
export const ADMIN_ACTION_TYPES = {
  AdminAction: [
    { name: "action", type: "string" },
    { name: "payload", type: "string" },
    { name: "nonce", type: "string" },
    { name: "issuedAt", type: "uint64" },
  ],
} as const;

export function adminDomain(chainId: number) {
  return { name: "KWOTA Admin", version: "1", chainId } as const;
}
