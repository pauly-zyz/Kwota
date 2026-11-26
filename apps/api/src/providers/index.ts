import type { Env } from "../env";
import { MockProvider } from "./mock";
import { OpenRouterProvider } from "./openrouter";
import type { ModelProvider } from "./types";

export * from "./types";

/** Registry of providers keyed by `models.provider`. Swap or add providers here. */
export function createProviders(env: Env): Map<string, ModelProvider> {
  const m = new Map<string, ModelProvider>();
  m.set("mock", new MockProvider());
  if (env.OPENROUTER_API_KEY) {
    m.set(
      "openrouter",
      new OpenRouterProvider({
        apiKey: env.OPENROUTER_API_KEY,
        baseUrl: env.OPENROUTER_BASE_URL,
        appName: env.OPENROUTER_APP_NAME,
        referer: env.PUBLIC_API_URL,
      }),
    );
  } else if (env.MODEL_PROVIDER === "openrouter") {
    throw new Error("MODEL_PROVIDER=openrouter requires OPENROUTER_API_KEY");
  }
  return m;
}
