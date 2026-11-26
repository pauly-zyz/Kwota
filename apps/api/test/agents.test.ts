import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keccak256, toHex } from "viem";
import { AGENT_REQUEST_TYPES, agentDomain } from "@kwota/core";
import { agentWallet, credit, holder, login, other, REGISTRY, setup } from "./helpers";

let s: Awaited<ReturnType<typeof setup>>;
let session: string;
let agentId: number;
let nonce = 1n;

beforeAll(async () => {
  s = await setup();
  session = await login(s.app, holder);
  await credit(s.ctx, holder.address, "5");
});
afterAll(async () => {
  await s.app.close();
  await s.ctx.close();
});

const authed = (method: "GET" | "POST" | "PATCH", url: string, payload?: unknown, token = session) =>
  s.app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as never });

async function signedChat(body: object, opts: { expiry?: bigint; nonce?: bigint; signer?: typeof agentWallet; tokenId?: bigint } = {}) {
  const raw = JSON.stringify(body);
  const expiry = opts.expiry ?? BigInt(Math.floor(Date.now() / 1000) + 60);
  const n = opts.nonce ?? nonce++;
  const tokenId = opts.tokenId ?? 1n;
  const signature = await (opts.signer ?? agentWallet).signTypedData({
    domain: agentDomain(46630, REGISTRY),
    types: AGENT_REQUEST_TYPES,
    primaryType: "KwotaRequest",
    message: { agentId: tokenId, bodyHash: keccak256(toHex(raw)), nonce: n, expiry },
  });
  return s.app.inject({
    method: "POST",
    url: "/v1/chat/completions",
    headers: {
      "content-type": "application/json",
      "x-kwota-agent": tokenId.toString(),
      "x-kwota-registry": REGISTRY,
      "x-kwota-nonce": n.toString(),
      "x-kwota-expiry": expiry.toString(),
      "x-kwota-signature": signature,
    },
    payload: raw,
  });
}

const body = { model: "kwota/mock-large", messages: [{ role: "user", content: "agent task" }], max_tokens: 64 };

describe("agent registration", () => {
  it("only the ERC-8004 owner can register an agent", async () => {
    const res = await authed("POST", "/me/agents", { registryId: 1, agentTokenId: "2", dailyLimit: "1" });
    expect(res.statusCode).toBe(403);
    const unknown = await authed("POST", "/me/agents", { registryId: 1, agentTokenId: "99", dailyLimit: "1" });
    expect(unknown.statusCode).toBe(400);
  });

  it("owner registers agent with a daily limit", async () => {
    const res = await authed("POST", "/me/agents", { registryId: 1, agentTokenId: "1", name: "Researcher", dailyLimit: "0.05" });
    expect(res.statusCode).toBe(200);
    agentId = res.json().id;
    expect(res.json().agentWallet).toBe(agentWallet.address.toLowerCase());
  });

  it("other users cannot manage the agent", async () => {
    const otherSession = await login(s.app, other);
    expect((await authed("POST", `/me/agents/${agentId}/allocate`, { amount: "1" }, otherSession)).statusCode).toBe(403);
  });
});

describe("allocation & signed requests", () => {
  it("unfunded agent gets 402", async () => {
    const res = await signedChat(body);
    expect(res.statusCode).toBe(402);
  });

  it("holder allocates kwota to the agent (double-entry)", async () => {
    const res = await authed("POST", `/me/agents/${agentId}/allocate`, { amount: "1" });
    expect(res.statusCode).toBe(200);
    const list = (await authed("GET", "/me/agents")).json();
    expect(list[0].account.balanceMicro).toBe("1000000");
    const me = (await authed("GET", "/me")).json();
    expect(me.kwota.balanceMicro).toBe("4000000");
  });

  it("cannot allocate more than the free balance", async () => {
    expect((await authed("POST", `/me/agents/${agentId}/allocate`, { amount: "100" })).statusCode).toBe(402);
  });

  it("valid EIP-712 request is served and charged to the agent account", async () => {
    const res = await signedChat(body, { nonce: 1000n });
    expect(res.statusCode).toBe(200);
    const list = (await authed("GET", "/me/agents")).json();
    expect(BigInt(list[0].account.balanceMicro)).toBeLessThan(1_000_000n);
    expect(BigInt(list[0].spentTodayMicro)).toBeGreaterThan(0n);
  });

  it("replayed nonce is rejected", async () => {
    const res = await signedChat(body, { nonce: 1000n });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("replay");
  });

  it("expired or far-future signatures are rejected", async () => {
    expect((await signedChat(body, { expiry: BigInt(Math.floor(Date.now() / 1000) - 1) })).statusCode).toBe(401);
    expect((await signedChat(body, { expiry: BigInt(Math.floor(Date.now() / 1000) + 3600) })).statusCode).toBe(401);
  });

  it("signature from a different wallet is rejected", async () => {
    const res = await signedChat(body, { signer: other });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("bad_signature");
  });

  it("tampered body is rejected (body hash bound to signature)", async () => {
    const raw = JSON.stringify(body);
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 60);
    const signature = await agentWallet.signTypedData({
      domain: agentDomain(46630, REGISTRY), types: AGENT_REQUEST_TYPES, primaryType: "KwotaRequest",
      message: { agentId: 1n, bodyHash: keccak256(toHex(raw)), nonce: 777n, expiry },
    });
    const res = await s.app.inject({
      method: "POST", url: "/v1/chat/completions",
      headers: { "content-type": "application/json", "x-kwota-agent": "1", "x-kwota-registry": REGISTRY, "x-kwota-nonce": "777", "x-kwota-expiry": expiry.toString(), "x-kwota-signature": signature },
      payload: JSON.stringify({ ...body, max_tokens: 4000 }),
    });
    expect(res.statusCode).toBe(401);
  });

  it("daily limit stops the agent", async () => {
    await authed("PATCH", `/me/agents/${agentId}`, { dailyLimit: "0.001" });
    const res = await signedChat({ ...body, max_tokens: 2000 });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe("daily_limit_exceeded");
    await authed("PATCH", `/me/agents/${agentId}`, { dailyLimit: "1" });
  });

  it("agent API key is bound to the agent account", async () => {
    const k = (await authed("POST", "/me/keys", { name: "agent-key", agentId })).json().key;
    const before = (await authed("GET", "/me")).json().kwota.balanceMicro;
    const res = await s.app.inject({ method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${k}` }, payload: body });
    expect(res.statusCode).toBe(200);
    expect((await authed("GET", "/me")).json().kwota.balanceMicro).toBe(before); // holder untouched
  });

  it("stop button blocks the agent and reclaims the remaining allocation", async () => {
    const res = await authed("POST", `/me/agents/${agentId}/stop`, {});
    expect(res.statusCode).toBe(200);
    expect(res.json().agent.status).toBe("stopped");
    const blocked = await signedChat(body);
    expect(blocked.statusCode).toBe(403);
    const list = (await authed("GET", "/me/agents")).json();
    expect(list[0].account.balanceMicro).toBe("0");
    expect(await s.ctx.ledger.reconcile()).toEqual([]);
  });

  it("ownership change freezes the agent", async () => {
    await authed("POST", `/me/agents/${agentId}/resume`, {});
    (s.ctx.registry as unknown as { data: Record<string, Record<string, { owner: string }>> }).data[REGISTRY]!["1"] = { owner: other.address };
    const r = await authed("POST", `/me/agents/${agentId}/refresh`, {});
    expect(r.json().status).toBe("frozen");
    expect((await authed("POST", `/me/agents/${agentId}/resume`, {})).statusCode).toBe(400);
  });
});
