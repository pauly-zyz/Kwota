import { z } from "zod";
import { OFFICIAL_NETWORKS } from "@kwota/config";

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((s) => s.toLowerCase() as `0x${string}`);
const optAddr = z.preprocess((v) => (v === "" ? undefined : v), addr.optional());
const addrList = z
  .string()
  .default("")
  .transform((s) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))
  .pipe(z.array(z.string().regex(/^0x[0-9a-f]{40}$/)));
const bool = z.enum(["true", "false", "1", "0", ""]).default("false").transform((v) => v === "true" || v === "1");

export const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("postgres://kwota:kwota@localhost:5432/kwota"),
  REDIS_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(16).default("dev-only-session-secret-change-me"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  PUBLIC_API_URL: z.string().default("http://localhost:8787"),

  CHAIN_ID: z.coerce.number().default(46630),
  RPC_URL: z.string().default(""),
  EXPLORER_URL: z.string().default(""),
  BLOCKSCOUT_API_URL: z.string().default(""),
  CONFIRMATIONS: z.coerce.number().default(10),
  INDEXER_START_BLOCK: z.coerce.bigint().default(0n),
  INDEXER_BATCH_BLOCKS: z.coerce.bigint().default(2000n),
  INDEXER_POLL_MS: z.coerce.number().default(5000),

  KWOTA_TOKEN_ADDRESS: optAddr,
  TREASURY_ADDRESS: optAddr,
  POOL_WALLET_ADDRESS: optAddr,
  VAULT_ADDRESS: optAddr,
  OPS_WALLET_ADDRESS: optAddr,
  LP_PAIR_ADDRESSES: addrList,
  PROTOCOL_ADDRESSES: addrList,
  ANT_ADDRESS: addr.default("0xbbb6c29bcc3a1028a2b54310df73f4f7a3bcb373"),
  STABLE_TOKEN_ADDRESSES: addrList,
  TRACKED_FEE_TOKENS: addrList,
  ADMIN_ADDRESSES: addrList,

  EPOCH_GENESIS_TIME: z.coerce.number().default(0),
  AUTO_PUBLISH_EPOCHS: bool,

  MODEL_PROVIDER: z.enum(["openrouter", "openai_compatible", "mock"]).default("mock"),
  // Generic OpenAI-compatible provider (e.g. Surplus Intelligence)
  PROVIDER_ID: z.string().regex(/^[a-z0-9_-]{2,32}$/).default("surplus"),
  PROVIDER_BASE_URL: z.string().default(""),
  PROVIDER_API_KEY: z.string().default(""),
  /** comma-separated provider model ids imported by `seed` (with the provider's own per-token pricing) */
  SEED_MODELS: z.string().default(""),
  /** run indexer + epoch worker inside the API process (single-service hosting) */
  RUN_INDEXER: bool,
  RUN_WORKER: bool,
  AUTO_SEED: bool,
  /** testnet convenience: admin can credit/debit kwota with a signed, audited action */
  ALLOW_ADMIN_ADJUST: bool,
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  OPENROUTER_APP_NAME: z.string().default("KWOTA"),

  AGENT_REGISTRY_MOCK: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(src: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(src);
  if (!parsed.success) {
    throw new Error("Invalid environment: " + JSON.stringify(parsed.error.flatten().fieldErrors));
  }
  const env = parsed.data;
  // official public endpoints (docs.robinhood.com) when not overridden; tests pass RPC_URL="" explicitly via NODE_ENV=test
  if (env.NODE_ENV !== "test") {
    const off = OFFICIAL_NETWORKS[env.CHAIN_ID];
    if (off && !env.RPC_URL) env.RPC_URL = off.rpcUrl;
    if (off && !env.EXPLORER_URL) env.EXPLORER_URL = off.explorerUrl;
    if (off && !env.BLOCKSCOUT_API_URL) env.BLOCKSCOUT_API_URL = off.explorerUrl;
  }
  if (env.NODE_ENV === "production" && env.SESSION_SECRET.startsWith("dev-only")) {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return env;
}
