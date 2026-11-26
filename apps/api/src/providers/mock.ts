import type { ChatResult, ChatStream, ModelProvider, ProviderChatRequest, StreamChunk } from "./types";

/**
 * Deterministic offline provider for local development & tests. Replies with a
 * short echo; token counts are derived from text length so metering is exercised.
 */
export class MockProvider implements ModelProvider {
  id = "mock";
  private reply(req: ProviderChatRequest) {
    const last = [...req.messages].reverse().find((m) => m.role === "user");
    const text = typeof last?.content === "string" ? last.content : "…";
    const words = `[mock ${req.model}] You said: ${text}`.split(" ");
    const out = words.slice(0, Math.max(1, Math.min(words.length, req.max_tokens)));
    const promptTokens = req.messages.reduce((n, m) => n + Math.ceil(String(m.content ?? "").length / 4) + 4, 0);
    return { out, promptTokens };
  }

  async chat(req: ProviderChatRequest): Promise<ChatResult> {
    const { out, promptTokens } = this.reply(req);
    const content = out.join(" ");
    const usage = { prompt_tokens: promptTokens, completion_tokens: out.length };
    return {
      body: {
        id: `mock-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: req.model,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { ...usage, total_tokens: usage.prompt_tokens + usage.completion_tokens },
      },
      usage,
      providerRequestId: "mock",
    };
  }

  async chatStream(req: ProviderChatRequest): Promise<ChatStream> {
    const { out, promptTokens } = this.reply(req);
    const id = `mock-${Date.now()}`;
    async function* gen(): AsyncIterable<StreamChunk> {
      for (let i = 0; i < out.length; i++) {
        yield {
          data: {
            id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: req.model,
            choices: [{ index: 0, delta: { content: (i ? " " : "") + out[i] }, finish_reason: null }],
          },
        };
      }
      yield { data: { id, object: "chat.completion.chunk", model: req.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] } };
    }
    return { chunks: gen(), usage: () => ({ prompt_tokens: promptTokens, completion_tokens: out.length }), providerRequestId: id };
  }
}
