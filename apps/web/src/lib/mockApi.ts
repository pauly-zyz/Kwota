"use client";
/**
 * In-browser demo backend used while NEXT_PUBLIC_API_URL is not set.
 * Mirrors the real API's routes and response shapes; state lives in this
 * browser only (localStorage). Nothing here is real kwota.
 */
import { usageCostMicro, estimateInputTokens } from "@kwota/core/pricing";
import { demoModels } from "./demo";

export const DEMO_REGISTRY = "0x0000000000000000000000000000000000008004";

interface Ledger { id: string; deltaMicro: string; kind: string; refType: string | null; refId: string | null; balanceAfterMicro: string; createdAt: string; accountType: "holder" | "agent"; agentId: number | null }
interface Key { id: number; name: string; prefix: string; agentId: number | null; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; rpmLimit: number | null; maxCostPerRequestMicro: string | null }
interface Agent { id: number; agentTokenId: string; name: string | null; agentWallet: string; ownerAddress: string; status: "active" | "stopped" | "frozen"; dailyLimitMicro: string; balanceMicro: string; spentTodayMicro: string; day: string }
interface State { v: 1; address: string; balanceMicro: string; ledger: Ledger[]; keys: Key[]; agents: Agent[]; nextId: number; epochEnd: number }

const KEY = (a: string) => `kwota.demo.${a.toLowerCase()}`;
const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
const iso = (sec: number) => new Date(sec * 1000).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export class DemoError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function seed(address: string): State {
  const t = now();
  const epochStart = t - (t % DAY);
  const credits = [3_842_100, 4_120_550, 3_975_300, 4_401_900];
  const ledger: Ledger[] = [];
  let bal = 0;
  let id = 1;
  credits.forEach((c, i) => {
    bal += c;
    ledger.push({ id: String(id++), deltaMicro: String(c), kind: "epoch_credit", refType: "epoch", refId: String(18 + i), balanceAfterMicro: String(bal), createdAt: iso(epochStart - (credits.length - 1 - i) * DAY + 300), accountType: "holder", agentId: null });
    if (i > 0) {
      const used = 180_000 + i * 97_331;
      bal -= used;
      ledger.push({ id: String(id++), deltaMicro: String(-used), kind: "usage_debit", refType: "usage", refId: String(1000 + i), balanceAfterMicro: String(bal), createdAt: iso(epochStart - (credits.length - 1 - i) * DAY + 7200), accountType: "holder", agentId: null });
    }
  });
  return { v: 1, address: address.toLowerCase(), balanceMicro: String(bal), ledger: ledger.reverse(), keys: [], agents: [], nextId: id, epochEnd: epochStart + DAY };
}

function load(address: string): State {
  try {
    const raw = localStorage.getItem(KEY(address));
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.v === 1) return s;
    }
  } catch {
    /* storage unavailable */
  }
  return seed(address);
}
function save(s: State) {
  try {
    localStorage.setItem(KEY(s.address), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function post(s: State, deltaMicro: bigint, kind: string, accountType: "holder" | "agent" = "holder", agentId: number | null = null, refId: string | null = null) {
  let after: bigint;
  if (accountType === "holder") {
    after = BigInt(s.balanceMicro) + deltaMicro;
    if (after < 0n) throw new DemoError(402, "insufficient_kwota", "insufficient kwota balance");
    s.balanceMicro = after.toString();
  } else {
    const a = s.agents.find((x) => x.id === agentId)!;
    after = BigInt(a.balanceMicro) + deltaMicro;
    if (after < 0n) throw new DemoError(402, "insufficient_kwota", "insufficient agent balance");
    a.balanceMicro = after.toString();
  }
  s.ledger.unshift({ id: String(s.nextId++), deltaMicro: deltaMicro.toString(), kind, refType: null, refId, balanceAfterMicro: after.toString(), createdAt: new Date().toISOString(), accountType, agentId });
}

function parseAmount(v: unknown): bigint {
  const str = String(v ?? "").trim();
  if (!/^\d+(\.\d{1,6})?$/.test(str)) throw new DemoError(400, "invalid_request", "invalid kwota amount");
  const [w, f = ""] = str.split(".");
  return BigInt(w!) * 1_000_000n + BigInt(f.padEnd(6, "0"));
}

function rolloverEpoch(s: State) {
  while (now() >= s.epochEnd) {
    const credit = 3_500_000n + BigInt(Math.floor(Math.random() * 1_000_000));
    post(s, credit, "epoch_credit", "holder", null, "demo");
    s.epochEnd += DAY;
  }
  for (const a of s.agents) if (a.day !== today()) { a.day = today(); a.spentTodayMicro = "0"; }
}

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function mockApi(address: string | null, path: string, method: string, body: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120));
  const url = new URL(path, "http://demo");
  const p = url.pathname;
  if (p === "/v1/models") {
    return { object: "list", data: demoModels.map((m) => ({ id: m.id, object: "model", name: m.displayName, context_length: m.contextLength, pricing: { kwota_per_mtok_input: Number(m.inputPriceMicroPerMTok) / 1e6, kwota_per_mtok_output: Number(m.outputPriceMicroPerMTok) / 1e6 } })) };
  }
  if (p === "/agents/registries") return [{ id: 1, name: "Demo ERC-8004 registry", address: DEMO_REGISTRY, chainId: 46630, enabled: true }];
  if (!address) throw new DemoError(401, "unauthorized", "sign in first");
  const s = load(address);
  rolloverEpoch(s);
  const b = (body ?? {}) as Record<string, unknown>;
  const B = (x: string) => BigInt(x);
  let m: RegExpMatchArray | null;
  try {
    if (p === "/me" && method === "GET") {
      const t = now();
      const elapsed = t - (s.epochEnd - DAY);
      return {
        address: s.address, isAdmin: false,
        kwota: { balanceMicro: s.balanceMicro, reservedMicro: "0", availableMicro: s.balanceMicro },
        indexedTokenBalanceRaw: "250000000000000000000000",
        estimate: { epochId: 22, estimateMicro: String(Math.floor(4_100_000 * (elapsed / DAY))), sharePpm: 4120, projectedBudgetMicro: "995000000", endsAt: s.epochEnd },
      };
    }
    if (p === "/me/ledger") return s.ledger.slice(0, 50);
    if (p === "/me/usage") return [];
    if (p === "/me/keys" && method === "GET") return s.keys;
    if (p === "/me/keys" && method === "POST") {
      const prefix = hex(5);
      const key: Key = { id: s.nextId++, name: String(b.name || "default").slice(0, 64), prefix, agentId: (b.agentId as number) ?? null, createdAt: new Date().toISOString(), lastUsedAt: null, revokedAt: null, rpmLimit: null, maxCostPerRequestMicro: b.maxCostPerRequest ? parseAmount(b.maxCostPerRequest).toString() : null };
      s.keys.unshift(key);
      return { ...key, key: `kw_demo_${prefix}_${hex(20)}`, note: "Demo key — it does not work against a real API." };
    }
    if ((m = p.match(/^\/me\/keys\/(\d+)$/)) && method === "DELETE") {
      const k = s.keys.find((x) => x.id === Number(m![1]));
      if (!k) throw new DemoError(404, "not_found", "key not found");
      k.revokedAt = new Date().toISOString();
      return { revoked: true };
    }
    if (p === "/me/agents" && method === "GET") {
      return s.agents.map((a) => ({
        agent: { id: a.id, agentTokenId: a.agentTokenId, name: a.name, agentWallet: a.agentWallet, ownerAddress: a.ownerAddress, status: a.status, dailyLimitMicro: a.dailyLimitMicro },
        account: { balanceMicro: a.balanceMicro, reservedMicro: "0" },
        registry: { id: 1, name: "Demo ERC-8004 registry", address: DEMO_REGISTRY, chainId: 46630 },
        spentTodayMicro: a.spentTodayMicro,
      }));
    }
    if (p === "/me/agents" && method === "POST") {
      const tokenId = String(b.agentTokenId ?? "");
      if (!/^\d{1,12}$/.test(tokenId)) throw new DemoError(400, "invalid_request", "agent id must be a number");
      if (s.agents.some((a) => a.agentTokenId === tokenId)) throw new DemoError(400, "invalid_request", "agent already registered");
      if (s.agents.length >= 10) throw new DemoError(400, "invalid_request", "agent limit reached");
      const a: Agent = { id: s.nextId++, agentTokenId: tokenId, name: (b.name as string) || null, agentWallet: `0x${hex(20)}`, ownerAddress: s.address, status: "active", dailyLimitMicro: parseAmount(b.dailyLimit).toString(), balanceMicro: "0", spentTodayMicro: "0", day: today() };
      s.agents.push(a);
      return a;
    }
    if ((m = p.match(/^\/me\/agents\/(\d+)(?:\/(\w+))?$/))) {
      const a = s.agents.find((x) => x.id === Number(m![1]));
      if (!a) throw new DemoError(404, "not_found", "agent not found");
      const op = m[2];
      if (op === "allocate") {
        if (a.status !== "active") throw new DemoError(400, "invalid_request", "agent is not active");
        const amt = parseAmount(b.amount);
        if (amt <= 0n) throw new DemoError(400, "invalid_request", "amount must be positive");
        post(s, -amt, "allocation_out", "holder", a.id, String(a.id));
        post(s, amt, "allocation_in", "agent", a.id, String(a.id));
        return { ok: true };
      }
      const reclaim = () => {
        const amt = B(a.balanceMicro);
        if (amt > 0n) {
          post(s, -amt, "reclaim_out", "agent", a.id, String(a.id));
          post(s, amt, "reclaim_in", "holder", a.id, String(a.id));
        }
      };
      if (op === "reclaim") return reclaim(), { ok: true };
      if (op === "stop") return (a.status = "stopped"), reclaim(), { agent: a };
      if (op === "resume") return (a.status = "active"), a;
      if (op === "refresh") return a;
      if (!op && method === "PATCH") return (a.dailyLimitMicro = parseAmount(b.dailyLimit).toString()), a;
    }
    throw new DemoError(404, "not_found", `demo: ${method} ${p} is not available`);
  } finally {
    save(s);
  }
}

const REPLIES = [
  "KWOTA turns $KWOTA trading fees into metered AI usage. Each epoch, realized pool stablecoins are split between holders by time-weighted balance, and every request you send here is billed per token from that balance.",
  "This is the demo playground. When the KWOTA API is live, the same box streams real model output and deducts real kwota — the cost line under each answer shows exactly what was charged.",
  "Agents get their own sub-balance: you allocate kwota, set a daily cap, and they sign each request with EIP-712 (nonce + expiry). One click on Stop freezes them and returns what's left.",
  "Transparency first: fee inflows, the 50/30/20 split, the ANT vault balance, Merkle roots per epoch and model prices are all published on the transparency page.",
];

/** Simulated streaming chat for the demo playground; bills the demo balance. */
export async function* mockChat(address: string, model: string, messages: { role: string; content: string }[]): AsyncGenerator<{ text?: string; costMicro?: string }> {
  const m = demoModels.find((x) => x.id === model) ?? demoModels[0]!;
  const s0 = load(address);
  if (BigInt(s0.balanceMicro) <= 0n) throw new DemoError(402, "insufficient_kwota", "insufficient kwota balance");
  const last = messages[messages.length - 1]?.content ?? "";
  const reply = `${REPLIES[(messages.length + last.length) % REPLIES.length]}\n\n(demo reply · ${m.displayName})`;
  const words = reply.split(/(\s+)/);
  for (const w of words) {
    await new Promise((r) => setTimeout(r, 18));
    yield { text: w };
  }
  const price = { inputPriceMicroPerMTok: BigInt(m.inputPriceMicroPerMTok), outputPriceMicroPerMTok: BigInt(m.outputPriceMicroPerMTok), markupBps: m.markupBps };
  const cost = usageCostMicro(price, estimateInputTokens(messages), Math.ceil(reply.length / 4));
  const s = load(address);
  post(s, -(cost < BigInt(s.balanceMicro) ? cost : BigInt(s.balanceMicro)), "usage_debit", "holder", null, "playground");
  save(s);
  yield { costMicro: cost.toString() };
}
