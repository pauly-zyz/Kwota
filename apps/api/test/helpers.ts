import postgres from "postgres";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { runMigrations } from "@kwota/db/migrate";
import { loadEnv, type Env } from "../src/env";
import { createContext, type Ctx } from "../src/context";
import { buildApp } from "../src/app";
import { MemoryKv } from "../src/lib/kv";
import { MockRegistryAdapter } from "../src/agents/registry";
import { tables } from "@kwota/db";
import { parseKwota } from "@kwota/core";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://kwota:kwota@localhost:5432/kwota_test";

export const TOKEN = "0x00000000000000000000000000000000000c0de1";
export const TREASURY = "0x00000000000000000000000000000000000000e1";
export const POOL = "0x00000000000000000000000000000000000000e2";
export const VAULT = "0x00000000000000000000000000000000000000e3";
export const OPS = "0x00000000000000000000000000000000000000e4";
export const LP = "0x00000000000000000000000000000000000000f1";
export const USDG = "0x00000000000000000000000000000000000005d1";
export const REGISTRY = "0x0000000000000000000000000000000000008004";

export const holder = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
export const other = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
export const agentWallet = privateKeyToAccount("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
export const admin = privateKeyToAccount("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a");

export async function resetDb() {
  const sql = postgres(TEST_DB, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  await runMigrations(TEST_DB);
}

export function testEnv(over: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DB,
    CHAIN_ID: "46630",
    CORS_ORIGINS: "http://localhost:3000",
    KWOTA_TOKEN_ADDRESS: TOKEN,
    TREASURY_ADDRESS: TREASURY,
    POOL_WALLET_ADDRESS: POOL,
    VAULT_ADDRESS: VAULT,
    OPS_WALLET_ADDRESS: OPS,
    LP_PAIR_ADDRESSES: LP,
    STABLE_TOKEN_ADDRESSES: USDG,
    ADMIN_ADDRESSES: admin.address,
    MODEL_PROVIDER: "mock",
    ...over,
  });
}

export async function setup(over: Record<string, string> = {}) {
  await resetDb();
  const env = testEnv(over);
  const registry = new MockRegistryAdapter({
    [REGISTRY]: {
      "1": { owner: holder.address, wallet: agentWallet.address },
      "2": { owner: other.address },
    },
  });
  const ctx = createContext(env, { kv: new MemoryKv(), client: null, registry });
  const app = await buildApp(ctx);
  await ctx.db.insert(tables.models).values([
    { id: "kwota/mock-large", provider: "mock", providerModelId: "mock-large", displayName: "Mock Large", contextLength: 128000, inputPriceMicroPerMTok: parseKwota("3"), outputPriceMicroPerMTok: parseKwota("15"), markupBps: 0 },
  ]);
  await ctx.db.insert(tables.agentRegistries).values({ chainId: env.CHAIN_ID, address: REGISTRY, name: "Test registry" });
  return { env, ctx, app };
}

export async function login(app: Awaited<ReturnType<typeof setup>>["app"], account: PrivateKeyAccount) {
  const { nonce } = (await app.inject({ method: "GET", url: "/auth/nonce" })).json();
  const message = createSiweMessage({ address: account.address, chainId: 46630, domain: "localhost:3000", nonce, uri: "http://localhost:3000", version: "1", issuedAt: new Date() });
  const signature = await account.signMessage({ message });
  const res = await app.inject({ method: "POST", url: "/auth/verify", payload: { message, signature } });
  if (res.statusCode !== 200) throw new Error(res.body);
  return res.json().token as string;
}

export async function credit(ctx: Ctx, address: string, kwota: string) {
  const u = await ctx.ledger.ensureUser(address);
  const acc = await ctx.ledger.holderAccount(u.id);
  await ctx.ledger.post({ accountId: acc.id, deltaMicro: parseKwota(kwota), kind: "admin_adjust", refType: "test", refId: `${Date.now()}-${Math.random()}`, actor: "test" });
  return acc;
}
