import { createPublicClient, http, type PublicClient } from "viem";
import { robinhoodChain } from "@kwota/config";
import { createDb, type Db } from "@kwota/db";
import type { Env } from "./env";
import { createKv, type Kv } from "./lib/kv";
import { Ledger } from "./ledger";
import { ParamService } from "./params";
import { createProviders, type ModelProvider } from "./providers";
import { AgentService } from "./agents/service";
import { CompositeRegistryAdapter, Erc8004Adapter, MockRegistryAdapter, type AgentRegistryAdapter } from "./agents/registry";

export interface Ctx {
  env: Env;
  db: Db;
  kv: Kv;
  client: PublicClient | null;
  ledger: Ledger;
  params: ParamService;
  providers: Map<string, ModelProvider>;
  agents: AgentService;
  registry: AgentRegistryAdapter;
  close(): Promise<void>;
}

export function createContext(env: Env, overrides: Partial<Pick<Ctx, "kv" | "client" | "registry" | "providers">> = {}): Ctx {
  const { db, client: pg } = createDb(env.DATABASE_URL);
  const kv = overrides.kv ?? createKv(env.REDIS_URL);
  const client =
    overrides.client !== undefined
      ? overrides.client
      : env.RPC_URL
        ? (createPublicClient({ chain: robinhoodChain({ chainId: env.CHAIN_ID, rpcUrl: env.RPC_URL, explorerUrl: env.EXPLORER_URL }), transport: http(env.RPC_URL) }) as PublicClient)
        : null;
  const registry =
    overrides.registry ?? new CompositeRegistryAdapter(MockRegistryAdapter.fromJson(env.AGENT_REGISTRY_MOCK), client ? new Erc8004Adapter(client) : null);
  const ledger = new Ledger(db);
  const params = new ParamService(db);
  return {
    env, db, kv, client, ledger, params, registry,
    providers: overrides.providers ?? createProviders(env),
    agents: new AgentService(db, ledger, params, registry),
    async close() {
      await kv.close();
      await pg.end();
    },
  };
}
