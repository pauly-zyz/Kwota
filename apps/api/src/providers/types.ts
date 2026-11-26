export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool" | "developer";
  content: unknown;
  name?: string;
  [k: string]: unknown;
}

export interface ProviderChatRequest {
  model: string; // provider model id
  messages: ChatMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  [k: string]: unknown;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface ChatResult {
  /** OpenAI-shaped completion body from the provider */
  body: Record<string, unknown>;
  usage: Usage;
  providerRequestId?: string;
}

export interface StreamChunk {
  /** raw OpenAI-style chunk object */
  data: Record<string, unknown>;
}

export interface ChatStream {
  chunks: AsyncIterable<StreamChunk>;
  /** resolves after the stream ends with final usage (provider-reported or estimated) */
  usage(): Usage;
  providerRequestId?: string;
}

export interface ModelProvider {
  id: string;
  chat(req: ProviderChatRequest, signal?: AbortSignal): Promise<ChatResult>;
  chatStream(req: ProviderChatRequest, signal?: AbortSignal): Promise<ChatStream>;
}

export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
