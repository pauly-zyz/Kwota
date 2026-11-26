import type { Env } from "../env";
import { MockProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openaiCompatible";
import type { ModelProvider } from "./types";

export * from "./types";

/** Registry of providers keyed by `models.provider`. Swap or add providers here. */
export function createProviders(env: Env): Map<string, ModelProvider> {
  const m = new Map<string, ModelProvider>();
  m.set("mock", new MockProvider());
  if (env.OPENROUTER_API_KEY) {
    m.set("openrouter", new OpenAICompatibleProvider({
      id: "openrouter", apiKey: env.OPENROUTER_API_KEY, baseUrl: env.OPENROUTER_BASE_URL,
      appName: env.OPENROUTER_APP_NAME, referer: env.PUBLIC_API_URL, openrouterUsage: true,
    }));
  }
  if (env.PROVIDER_API_KEY && env.PROVIDER_BASE_URL) {
    m.set(env.PROVIDER_ID, new OpenAICompatibleProvider({
      id: env.PROVIDER_ID, apiKey: env.PROVIDER_API_KEY, baseUrl: env.PROVIDER_BASE_URL, appName: env.OPENROUTER_APP_NAME,
    }));
  }
  if (env.MODEL_PROVIDER === "openrouter" && !m.has("openrouter")) throw new Error("MODEL_PROVIDER=openrouter requires OPENROUTER_API_KEY");
  if (env.MODEL_PROVIDER === "openai_compatible" && !m.has(env.PROVIDER_ID)) throw new Error("MODEL_PROVIDER=openai_compatible requires PROVIDER_BASE_URL and PROVIDER_API_KEY");
  return m;
}

/** Provider id that seeding / model import targets. */
export function primaryProviderId(env: Env) {
  return env.MODEL_PROVIDER === "openai_compatible" ? env.PROVIDER_ID : env.MODEL_PROVIDER;
}
