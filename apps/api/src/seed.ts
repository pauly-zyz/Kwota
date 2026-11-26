/**
 * Seed default model list (prices in USD per 1M tokens = kwota per 1M tokens),
 * agent registry and system exclusions. Idempotent.
 *
 * Prices: GPT-4o mini, Llama 3.3 70B and DeepSeek V3 taken from OpenRouter model
 * pages (Nov 2026; for multi-provider models the higher endpoint price is used so
 * kwota never undercharges). Gemini / Mistral / Qwen are estimates — confirm
 * against the live price list before launch (admin can edit in the dashboard).
 */
import { tables } from "@kwota/db";
import { parseKwota } from "@kwota/core";
import { loadEnv } from "./env";
import { createContext } from "./context";
import { runMigrations } from "@kwota/db/migrate";

const env = loadEnv();
await runMigrations(env.DATABASE_URL);
const ctx = createContext(env);
const live = env.MODEL_PROVIDER === "openrouter";

const models = live
  ? [
      { id: "openai/gpt-4o-mini", providerModelId: "openai/gpt-4o-mini", displayName: "GPT-4o mini", contextLength: 128000, input: "0.15", output: "0.60" },
      { id: "google/gemini-2.0-flash", providerModelId: "google/gemini-2.0-flash-001", displayName: "Gemini 2.0 Flash", contextLength: 1000000, input: "0.10", output: "0.40" },
      { id: "meta-llama/llama-3.3-70b", providerModelId: "meta-llama/llama-3.3-70b-instruct", displayName: "Llama 3.3 70B", contextLength: 131072, input: "0.10", output: "0.32" },
      { id: "deepseek/deepseek-chat", providerModelId: "deepseek/deepseek-chat", displayName: "DeepSeek V3", contextLength: 64000, input: "0.32", output: "1.03" },
      { id: "mistralai/mistral-small", providerModelId: "mistralai/mistral-small-3.1-24b-instruct", displayName: "Mistral Small 3.1", contextLength: 128000, input: "0.10", output: "0.30" },
      { id: "qwen/qwen-2.5-72b", providerModelId: "qwen/qwen-2.5-72b-instruct", displayName: "Qwen 2.5 72B", contextLength: 32768, input: "0.12", output: "0.39" },
    ]
  : [
      { id: "kwota/mock-small", providerModelId: "mock-small", displayName: "Mock Small (dev)", contextLength: 32000, input: "0.10", output: "0.40" },
      { id: "kwota/mock-large", providerModelId: "mock-large", displayName: "Mock Large (dev)", contextLength: 128000, input: "3.00", output: "15.00" },
    ];

let i = 0;
for (const m of models) {
  const v = {
    id: m.id, provider: live ? "openrouter" : "mock", providerModelId: m.providerModelId, displayName: m.displayName, contextLength: m.contextLength,
    inputPriceMicroPerMTok: parseKwota(m.input), outputPriceMicroPerMTok: parseKwota(m.output), markupBps: 0, enabled: true, sortOrder: i++,
  };
  await ctx.db.insert(tables.models).values(v).onConflictDoNothing();
}

if (process.env.AGENT_REGISTRY_ADDRESS) {
  await ctx.db
    .insert(tables.agentRegistries)
    .values({ chainId: env.CHAIN_ID, address: process.env.AGENT_REGISTRY_ADDRESS.toLowerCase(), name: process.env.AGENT_REGISTRY_NAME ?? "ERC-8004 Registry" })
    .onConflictDoNothing();
}
for (const reg of Object.keys(env.AGENT_REGISTRY_MOCK ? JSON.parse(env.AGENT_REGISTRY_MOCK) : {})) {
  await ctx.db.insert(tables.agentRegistries).values({ chainId: env.CHAIN_ID, address: reg.toLowerCase(), name: "Mock registry (dev)" }).onConflictDoNothing();
}
console.log(`seeded ${models.length} models`);
await ctx.close();
