"use client";
import { config } from "@/lib/config";
import { useApiBase } from "@/lib/apiMode";


function Code({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-ink-900 p-4 text-xs leading-relaxed text-fog-100"><code>{children}</code></pre>;
}

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="mt-12 scroll-mt-24 text-2xl font-semibold tracking-tight text-fog-100">{children}</h2>;
}

export default function Docs() {
  const api = useApiBase();
  const base = `${api}/v1`;
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[200px_1fr]">
      <aside className="hidden md:block">
        <nav className="sticky top-24 space-y-2 text-sm text-fog">
          {[["quick", "Quick start"], ["metering", "Metering"], ["agents", "Agents (EIP-712)"], ["agent-keys", "Agent API keys"], ["errors", "Errors"], ["verify", "Verify an epoch"]].map(([id, t]) => (
            <a key={id} href={`#${id}`} className="block hover:text-fog-100">{t}</a>
          ))}
        </nav>
      </aside>
      <article className="min-w-0 max-w-3xl text-fog">
        <h1 className="text-4xl font-semibold tracking-tight text-fog-100">API docs</h1>
        <p className="mt-3">KWOTA exposes an OpenAI-compatible API. Point any OpenAI SDK at the KWOTA base URL and use your KWOTA API key.</p>

        <H id="quick">Quick start</H>
        <p className="mt-2">1. Open the app, sign in with your wallet, and create an API key. 2. Call the API:</p>
        <Code>{`curl ${base}/chat/completions \\
  -H "Authorization: Bearer kw_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'`}</Code>
        <Code>{`import OpenAI from "openai";
const client = new OpenAI({ baseURL: "${base}", apiKey: process.env.KWOTA_API_KEY });
const r = await client.chat.completions.create({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "Hi" }], stream: true });
for await (const chunk of r) process.stdout.write(chunk.choices[0]?.delta?.content ?? "");`}</Code>
        <p className="mt-3">Endpoints: <code className="text-fog-100">GET /v1/models</code>, <code className="text-fog-100">POST /v1/chat/completions</code> (with <code>stream: true</code> support).</p>

        <H id="metering">Metering</H>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Cost = input tokens × input price + output tokens × output price (kwota per 1M tokens, listed on the transparency page). 1 kwota = $1.</li>
          <li>Before a request runs, the maximum possible cost is reserved; after it finishes you pay only for tokens actually used and the rest is released.</li>
          <li>Non-streaming responses include <code>kwota.cost_micro</code> and the headers <code>x-kwota-cost-micro</code> / <code>x-kwota-balance-micro</code> (µkwota = 10⁻⁶ kwota).</li>
          <li>Streaming responses end with an SSE comment line <code>: kwota {"{"}…cost_micro…{"}"}</code> that OpenAI parsers ignore.</li>
          <li>Limits: max cost per request, max output tokens, and requests per minute per key and per wallet (see transparency page).</li>
        </ul>

        <H id="agents">Agents — EIP-712 signed requests</H>
        <p className="mt-2">
          Register your ERC-8004 agent in the app and allocate kwota to it. The agent then signs each request with its agent wallet. The signature binds the
          exact request body, a unique nonce and a short expiry (≤ 5 minutes), so requests cannot be replayed or altered.
        </p>
        <Code>{`import { keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const agent = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const REGISTRY = "0x…";          // ERC-8004 identity registry
const AGENT_ID = 12n;            // your agent's id in that registry
const body = JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "Summarize…" }] });

const nonce = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
const expiry = BigInt(Math.floor(Date.now() / 1000) + 120);
const signature = await agent.signTypedData({
  domain: { name: "KWOTA Gateway", version: "1", chainId: ${config.chainId}, verifyingContract: REGISTRY },
  types: { KwotaRequest: [
    { name: "agentId", type: "uint256" }, { name: "bodyHash", type: "bytes32" },
    { name: "nonce", type: "uint256" }, { name: "expiry", type: "uint64" },
  ] },
  primaryType: "KwotaRequest",
  message: { agentId: AGENT_ID, bodyHash: keccak256(toHex(body)), nonce, expiry },
});

await fetch("${base}/chat/completions", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-kwota-agent": AGENT_ID.toString(),
    "x-kwota-registry": REGISTRY,
    "x-kwota-nonce": nonce.toString(),
    "x-kwota-expiry": expiry.toString(),
    "x-kwota-signature": signature,
  },
  body,   // send exactly the bytes you hashed
});`}</Code>
        <p className="mt-3">The signer must be the agent wallet recorded in the registry (or the owner if none is set). Smart-contract wallets (ERC-1271) are supported.</p>

        <H id="agent-keys">Agent API keys</H>
        <p className="mt-2">Alternatively create an API key bound to an agent (Agents → “New agent key”). It can only spend that agent’s allocation and respects its daily limit.</p>

        <H id="errors">Errors</H>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {[
                ["401 invalid_api_key / bad_signature / replay / signature_expired", "Authentication failed"],
                ["402 insufficient_kwota", "Not enough available kwota for the reserved maximum cost"],
                ["403 agent_inactive", "Agent stopped or frozen by its owner"],
                ["429 rate_limited / daily_limit_exceeded", "Per-minute limit or agent daily cap reached"],
                ["400 max_cost_exceeded", "Prompt too large for the per-request cost cap"],
                ["502 provider_error", "Upstream model error — nothing is charged"],
              ].map(([c, d]) => (
                <tr key={c} className="border-b border-line/60"><td className="py-2 pr-4 font-mono text-xs text-fog-100">{c}</td><td className="py-2">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <H id="verify">Verify an epoch yourself</H>
        <p className="mt-2">Each epoch publishes a JSON snapshot, its SHA-256 and a Merkle root. The verifier re-derives every allocation from on-chain Transfer events:</p>
        <Code>{`git clone <kwota repo> && cd kwota && pnpm install
pnpm --filter @kwota/api verify-epoch -- --api ${api} --epoch 12 --rpc <robinhood-chain-rpc> --from-block <token deploy block>`}</Code>
        <p className="mt-3">Leaf encoding (OpenZeppelin StandardMerkleTree): <code className="text-fog-100">(uint256 epochId, address holder, uint256 twab, uint256 kwotaMicro)</code>. Proofs: <code>GET /public/epochs/:id/proof/:address</code>.</p>
      </article>
    </div>
  );
}
