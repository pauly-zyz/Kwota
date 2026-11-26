import type { ChatResult, ChatStream, ModelProvider, ProviderChatRequest, StreamChunk, Usage } from "./types";
import { ProviderError } from "./types";

/**
 * Any OpenAI-compatible chat-completions provider (OpenRouter, Surplus Intelligence, …).
 * The API key lives only in server env.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  id: string;
  constructor(private opts: { id: string; apiKey: string; baseUrl: string; appName: string; referer?: string; openrouterUsage?: boolean }) {
    if (!opts.apiKey) throw new Error(`API key for provider '${opts.id}' missing`);
    this.id = opts.id;
    this.opts.baseUrl = opts.baseUrl.replace(/\/$/, "");
  }

  /** OpenRouter wants `usage: {include: true}`; other providers may reject unknown fields. */
  private extra() {
    return this.opts.openrouterUsage ? { usage: { include: true } } : {};
  }

  private headers() {
    return {
      authorization: `Bearer ${this.opts.apiKey}`,
      "content-type": "application/json",
      "x-title": this.opts.appName,
      ...(this.opts.referer ? { "http-referer": this.opts.referer } : {}),
    };
  }

  async chat(req: ProviderChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ ...req, ...this.extra(), stream: false }),
      signal,
    });
    if (!res.ok) throw new ProviderError(res.status, (await res.text()).slice(0, 500));
    const body = (await res.json()) as Record<string, unknown> & { usage?: Usage; id?: string };
    return {
      body,
      usage: { prompt_tokens: body.usage?.prompt_tokens ?? 0, completion_tokens: body.usage?.completion_tokens ?? 0 },
      providerRequestId: body.id,
    };
  }

  async chatStream(req: ProviderChatRequest, signal?: AbortSignal): Promise<ChatStream> {
    const res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ ...req, ...this.extra(), stream: true, stream_options: { include_usage: true } }),
      signal,
    });
    if (!res.ok || !res.body) throw new ProviderError(res.status, (await res.text()).slice(0, 500));
    let usage: Usage | null = null;
    let completionChars = 0;
    let id: string | undefined;
    const body = res.body;
    async function* iterate(): AsyncIterable<StreamChunk> {
      const reader = body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue; // comments / keep-alives
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(payload);
          } catch {
            continue;
          }
          id ??= data.id as string | undefined;
          const u = data.usage as Usage | undefined;
          if (u) usage = { prompt_tokens: u.prompt_tokens ?? 0, completion_tokens: u.completion_tokens ?? 0 };
          const choices = (data.choices as { delta?: { content?: string } }[] | undefined) ?? [];
          for (const c of choices) completionChars += c.delta?.content?.length ?? 0;
          yield { data };
        }
      }
    }
    return {
      chunks: iterate(),
      usage: () => usage ?? { prompt_tokens: 0, completion_tokens: Math.ceil(completionChars / 3) },
      get providerRequestId() {
        return id;
      },
    };
  }
}
