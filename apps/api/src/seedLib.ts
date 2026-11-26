import { tables } from "@kwota/db";
import { parseKwota } from "@kwota/core";
import type { Ctx } from "./context";
import { primaryProviderId } from "./providers";

/** Curated defaults for the generic provider (override with SEED_MODELS). No vendor of the ANT pair by default. */
export const DEFAULT_PROVIDER_MODELS = [
  "openai-gpt-oss-120b",
  "deepseek-v4-flash",
  "gpt-5-mini",
  "qwen3-235b-a22b-2507",
  "llama-3.3-70b-instruct",
  "mistral-small-3.2-24b-instruct",
  "gemini-3.1-flash-lite",
  "kimi-k2",
  "glm-4.7",
];

/** USD-per-token decimal string → µkwota per 1M tokens, rounded UP (never undercharge). */
export function perTokenToMicroPerMTok(price: string | number | null | undefined): bigint | null {
  if (price === null || price === undefined || price === "") return null;
  const s = String(price).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  const SCALE = 12; // 1e6 (µ) × 1e6 (per M tokens)
  const frac = f.padEnd(SCALE, "0");
  const head = BigInt(w! + frac.slice(0, SCALE));
  const rest = frac.slice(SCALE).replace(/0+$/, "");
  return rest ? head + 1n : head;
}

interface ProviderModel {
  id: string;
  name?: string;
  context_length?: number;
  top_provider?: { context_length?: number };
  pricing?: { prompt?: string; completion?: string };
}

/** Import models (with the provider's own per-token prices) from an OpenAI-compatible /models endpoint. */
export async function importProviderModels(ctx: Ctx, ids: string[]) {
  const env = ctx.env;
  const res = await fetch(`${env.PROVIDER_BASE_URL.replace(/\/$/, "")}/models`, { headers: { authorization: `Bearer ${env.PROVIDER_API_KEY}` } });
  if (!res.ok) throw new Error(`provider /models failed: ${res.status}`);
  const all = ((await res.json()) as { data: ProviderModel[] }).data ?? [];
  const byId = new Map(all.map((m) => [m.id, m]));
  let n = 0;
  for (const [i, id] of ids.entries()) {
    const m = byId.get(id);
    if (!m) continue;
    const inP = perTokenToMicroPerMTok(m.pricing?.prompt);
    const outP = perTokenToMicroPerMTok(m.pricing?.completion);
    if (inP === null || outP === null) continue;
    const priced = inP > 0n || outP > 0n;
    await ctx.db
      .insert(tables.models)
      .values({
        id: m.id, provider: env.PROVIDER_ID, providerModelId: m.id, displayName: m.name ?? m.id,
        contextLength: m.top_provider?.context_length ?? m.context_length ?? null,
        inputPriceMicroPerMTok: inP, outputPriceMicroPerMTok: outP, markupBps: 0,
        enabled: priced, // zero-priced models would be unmetered; import disabled
        sortOrder: i,
      })
      .onConflictDoNothing();
    n++;
  }
  return n;
}

const STATIC_MODELS = {
  openrouter: [
    { id: "openai/gpt-4o-mini", providerModelId: "openai/gpt-4o-mini", displayName: "GPT-4o mini", contextLength: 128000, input: "0.15", output: "0.60" },
    { id: "meta-llama/llama-3.3-70b", providerModelId: "meta-llama/llama-3.3-70b-instruct", displayName: "Llama 3.3 70B", contextLength: 131072, input: "0.10", output: "0.32" },
    { id: "deepseek/deepseek-chat", providerModelId: "deepseek/deepseek-chat", displayName: "DeepSeek V3", contextLength: 64000, input: "0.32", output: "1.03" },
  ],
  mock: [
    { id: "kwota/mock-small", providerModelId: "mock-small", displayName: "Mock Small (dev)", contextLength: 32000, input: "0.10", output: "0.40" },
    { id: "kwota/mock-large", providerModelId: "mock-large", displayName: "Mock Large (dev)", contextLength: 128000, input: "3.00", output: "15.00" },
  ],
};

/** Idempotent seed: models for the active provider, agent registries. */
export async function seedDefaults(ctx: Ctx) {
  const env = ctx.env;
  const provider = primaryProviderId(env);
  let models = 0;
  if (provider === env.PROVIDER_ID && env.MODEL_PROVIDER === "openai_compatible") {
    const ids = env.SEED_MODELS ? env.SEED_MODELS.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_PROVIDER_MODELS;
    models = await importProviderModels(ctx, ids);
  } else {
    const list = STATIC_MODELS[provider as keyof typeof STATIC_MODELS] ?? STATIC_MODELS.mock;
    for (const [i, m] of list.entries()) {
      await ctx.db
        .insert(tables.models)
        .values({
          id: m.id, provider: provider === "openrouter" ? "openrouter" : "mock", providerModelId: m.providerModelId, displayName: m.displayName,
          contextLength: m.contextLength, inputPriceMicroPerMTok: parseKwota(m.input), outputPriceMicroPerMTok: parseKwota(m.output), markupBps: 0, enabled: true, sortOrder: i,
        })
        .onConflictDoNothing();
      models++;
    }
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
  return { models };
}
