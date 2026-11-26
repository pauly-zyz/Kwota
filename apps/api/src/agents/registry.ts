import { getAddress, hexToString, isAddress, parseAbi, type PublicClient } from "viem";

export interface ResolvedAgent {
  owner: `0x${string}`;
  agentWallet: `0x${string}`;
  uri?: string;
}

export interface AgentRegistryAdapter {
  resolve(registry: `0x${string}`, agentId: bigint): Promise<ResolvedAgent | null>;
}

/** ERC-8004 Identity Registry (ERC-721 based). Works with any registry exposing these views. */
const ERC8004_ABI = parseAbi([
  "function ownerOf(uint256 agentId) view returns (address)",
  "function tokenURI(uint256 agentId) view returns (string)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function getMetadata(uint256 agentId, string key) view returns (bytes)",
]);

export class Erc8004Adapter implements AgentRegistryAdapter {
  constructor(private client: PublicClient) {}

  async resolve(registry: `0x${string}`, agentId: bigint): Promise<ResolvedAgent | null> {
    let owner: `0x${string}`;
    try {
      owner = await this.client.readContract({ address: registry, abi: ERC8004_ABI, functionName: "ownerOf", args: [agentId] });
    } catch {
      return null; // nonexistent token
    }
    let wallet: `0x${string}` | undefined;
    try {
      const w = await this.client.readContract({ address: registry, abi: ERC8004_ABI, functionName: "getAgentWallet", args: [agentId] });
      if (w && !/^0x0{40}$/i.test(w)) wallet = w;
    } catch {
      /* optional view */
    }
    if (!wallet) {
      try {
        const raw = await this.client.readContract({ address: registry, abi: ERC8004_ABI, functionName: "getMetadata", args: [agentId, "agentWallet"] });
        if (raw && raw !== "0x") {
          // either abi-encoded address (32 bytes) or utf8 string
          const candidate = raw.length === 66 ? (`0x${raw.slice(26)}` as `0x${string}`) : hexToString(raw);
          if (isAddress(candidate)) wallet = getAddress(candidate);
        }
      } catch {
        /* optional view */
      }
    }
    let uri: string | undefined;
    try {
      uri = await this.client.readContract({ address: registry, abi: ERC8004_ABI, functionName: "tokenURI", args: [agentId] });
    } catch {
      /* optional */
    }
    return { owner: owner.toLowerCase() as `0x${string}`, agentWallet: (wallet ?? owner).toLowerCase() as `0x${string}`, uri };
  }
}

/** Static registry for local development & tests. JSON: {"<registry>": {"<agentId>": {"owner": "0x…", "wallet": "0x…"}}} */
export class MockRegistryAdapter implements AgentRegistryAdapter {
  constructor(public data: Record<string, Record<string, { owner: string; wallet?: string }>>) {}
  static fromJson(json: string) {
    const parsed = json ? JSON.parse(json) : {};
    const norm: MockRegistryAdapter["data"] = {};
    for (const [r, agents] of Object.entries(parsed as MockRegistryAdapter["data"])) norm[r.toLowerCase()] = agents;
    return new MockRegistryAdapter(norm);
  }
  async resolve(registry: `0x${string}`, agentId: bigint): Promise<ResolvedAgent | null> {
    const a = this.data[registry.toLowerCase()]?.[agentId.toString()];
    if (!a) return null;
    return {
      owner: a.owner.toLowerCase() as `0x${string}`,
      agentWallet: (a.wallet ?? a.owner).toLowerCase() as `0x${string}`,
    };
  }
}

/** Routes to mock data when the registry is listed there, otherwise on-chain. */
export class CompositeRegistryAdapter implements AgentRegistryAdapter {
  constructor(private mock: MockRegistryAdapter, private onchain: AgentRegistryAdapter | null) {}
  async resolve(registry: `0x${string}`, agentId: bigint) {
    if (this.mock.data[registry.toLowerCase()]) return this.mock.resolve(registry, agentId);
    if (!this.onchain) throw new Error("RPC_URL not configured; cannot read agent registry");
    return this.onchain.resolve(registry, agentId);
  }
}
