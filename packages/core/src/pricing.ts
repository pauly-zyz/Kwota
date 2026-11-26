import { ceilDiv } from "./units";

export interface ModelPrice {
  /** µkwota per 1M input tokens (== USD per 1M tokens × 1e6) */
  inputPriceMicroPerMTok: bigint;
  outputPriceMicroPerMTok: bigint;
  markupBps: number;
}

/** cost = ceil((in × pIn + out × pOut) × (1 + markup) / 1e6) in µkwota. Never undercharges. */
export function usageCostMicro(p: ModelPrice, inputTokens: number, outputTokens: number): bigint {
  if (inputTokens < 0 || outputTokens < 0) throw new Error("negative token count");
  const raw = BigInt(inputTokens) * p.inputPriceMicroPerMTok + BigInt(outputTokens) * p.outputPriceMicroPerMTok;
  return ceilDiv(raw * BigInt(10_000 + p.markupBps), 10_000n * 1_000_000n);
}

export interface ChatMessageLike {
  role: string;
  content: unknown;
}

/** Conservative input-token estimate used only for reservations (≈ 1 token / 3 chars + overhead). */
export function estimateInputTokens(messages: ChatMessageLike[]): number {
  let chars = 0;
  for (const m of messages) {
    chars += m.role.length + 8;
    if (typeof m.content === "string") chars += m.content.length;
    else chars += JSON.stringify(m.content ?? "").length;
  }
  return Math.ceil(chars / 3) + 16;
}

export interface ReservationInput {
  price: ModelPrice;
  estimatedInputTokens: number;
  maxOutputTokens: number;
}

export function reservationMicro(r: ReservationInput): bigint {
  return usageCostMicro(r.price, r.estimatedInputTokens, r.maxOutputTokens);
}

/**
 * Pick max output tokens for a request: user's max_tokens capped by the server
 * limit and by what the per-request cost cap allows.
 */
export function capOutputTokens(opts: {
  requested?: number | null;
  serverMax: number;
  contextLength?: number | null;
  price: ModelPrice;
  estimatedInputTokens: number;
  maxCostMicro: bigint;
}): number {
  let out = Math.min(opts.requested ?? opts.serverMax, opts.serverMax);
  if (opts.contextLength) out = Math.min(out, Math.max(0, opts.contextLength - opts.estimatedInputTokens));
  if (opts.price.outputPriceMicroPerMTok > 0n) {
    const inCost = usageCostMicro(opts.price, opts.estimatedInputTokens, 0);
    const budget = opts.maxCostMicro - inCost;
    if (budget <= 0n) return 0;
    const perTok = (opts.price.outputPriceMicroPerMTok * BigInt(10_000 + opts.price.markupBps)) ;
    const affordable = Number((budget * 10_000n * 1_000_000n) / perTok);
    out = Math.min(out, affordable);
  }
  return Math.max(0, Math.floor(out));
}
