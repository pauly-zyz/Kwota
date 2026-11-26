import { createPublicClient, http, type PublicClient } from "viem";
import { robinhoodChain } from "@kwota/config";
import { createDb, type Db } from "@kwota/db";
import type { Env } from "./env";
import { MemoryKv, PgKv, RedisKv, type Kv } from "./lib/kv";
import { Ledger } from "./ledger";
import { ParamService } from "./params";
import { createProviders, type ModelProvider } from "./providers";
import { AgentService } from "./agents/service";
import { CompositeRegistryAdapter, Erc8004Adapter, MockRegistryAdapter, type AgentRegistryAdapter } from "./agents/registry";

/** Load (or create once) a random SESSION_SECRET persisted in the database. */
export async function ensureSessionSecret(ctx: Ctx) {
  if (!ctx.env.AUTO_SESSION_SECRET || !ctx.env.SESSION_SECRET.startsWith("dev-only")) return;
  const { randomBytes } = await import("node:crypto");
  const { tables } = await import("@kwota/db");
  const { eq } = await import("drizzle-orm");
  await ctx.db.insert(tables.appSecrets).values({ name: "session_secret", value: randomBytes(32).toString("hex") }).onConflictDoNothing();
  const [row] = await ctx.db.select().from(tables.appSecrets).where(eq(tables.appSecrets.name, "session_secret"));
  ctx.env.SESSION_SECRET = row!.value;
}

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
  const { db, client: pg } = createDb(env.DATABASE_URL, { max: env.DB_POOL_MAX });
  const backend = env.KV_BACKEND === "auto" ? (env.REDIS_URL ? "redis" : "memory") : env.KV_BACKEND;
  const kv = overrides.kv ?? (backend === "redis" ? new RedisKv(env.REDIS_URL!) : backend === "postgres" ? new PgKv(pg) : new MemoryKv());
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
