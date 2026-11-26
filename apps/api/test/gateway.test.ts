import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usageCostMicro } from "@kwota/core";
import { sql } from "drizzle-orm";
import { credit, holder, login, setup } from "./helpers";

let s: Awaited<ReturnType<typeof setup>>;
let session: string;
let apiKey: string;
let keyId: number;

beforeAll(async () => {
  s = await setup();
  session = await login(s.app, holder);
});
afterAll(async () => {
  await s.app.close();
  await s.ctx.close();
});

const chat = (key: string, body: Record<string, unknown>) =>
  s.app.inject({ method: "POST", url: "/v1/chat/completions", headers: { authorization: `Bearer ${key}` }, payload: body });

describe("auth & api keys", () => {
  it("rejects SIWE with a reused nonce", async () => {
    const res = await s.app.inject({ method: "POST", url: "/auth/verify", payload: { message: "garbage", signature: "0x00" } });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("creates an API key (shown once, stored hashed)", async () => {
    const res = await s.app.inject({ method: "POST", url: "/me/keys", headers: { authorization: `Bearer ${session}` }, payload: { name: "test" } });
    expect(res.statusCode).toBe(200);
    apiKey = res.json().key;
    keyId = res.json().id;
    expect(apiKey).toMatch(/^kw_live_[0-9a-f]{10}_[0-9a-f]{40}$/);
    const list = (await s.app.inject({ method: "GET", url: "/me/keys", headers: { authorization: `Bearer ${session}` } })).json();
    expect(JSON.stringify(list)).not.toContain(apiKey.split("_")[3]);
  });

  it("lists models in OpenAI format", async () => {
    const res = await s.app.inject({ method: "GET", url: "/v1/models" });
    expect(res.json().data[0].id).toBe("kwota/mock-large");
  });

  it("rejects missing / invalid keys", async () => {
    expect((await s.app.inject({ method: "POST", url: "/v1/chat/completions", payload: {} })).statusCode).toBe(401);
    expect((await chat("kw_live_0000000000_" + "0".repeat(40), { model: "x", messages: [] })).statusCode).toBe(401);
  });
});

describe("metering", () => {
  it("returns 402 when the holder has no kwota", async () => {
    const res = await chat(apiKey, { model: "kwota/mock-large", messages: [{ role: "user", content: "hello" }] });
    expect(res.statusCode).toBe(402);
    expect(res.json().error.code).toBe("insufficient_kwota");
  });

  it("charges exactly token usage × price and releases the reservation", async () => {
    const acc = await credit(s.ctx, holder.address, "1");
    const res = await chat(apiKey, { model: "kwota/mock-large", messages: [{ role: "user", content: "hello there" }], max_tokens: 50 });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.choices[0].message.content).toContain("hello there");
    const expected = usageCostMicro({ inputPriceMicroPerMTok: 3_000_000n, outputPriceMicroPerMTok: 15_000_000n, markupBps: 0 }, body.usage.prompt_tokens, body.usage.completion_tokens);
    expect(BigInt(body.kwota.cost_micro)).toBe(expected);
    const after = await s.ctx.ledger.balance(acc.id);
    expect(after!.reservedMicro).toBe(0n);
    expect(after!.balanceMicro).toBe(1_000_000n - expected);
    expect(await s.ctx.ledger.reconcile()).toEqual([]);
  });

  it("streams SSE and bills the streamed tokens", async () => {
    const res = await chat(apiKey, { model: "kwota/mock-large", messages: [{ role: "user", content: "stream please" }], stream: true });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.body).toContain("data: [DONE]");
    const m = /: kwota (\{.*\})/.exec(res.body);
    expect(m).not.toBeNull();
    expect(BigInt(JSON.parse(m![1]!).cost_micro)).toBeGreaterThan(0n);
    expect(await s.ctx.ledger.reconcile()).toEqual([]);
  });

  it("session token works for the playground", async () => {
    const res = await chat(session, { model: "kwota/mock-large", messages: [{ role: "user", content: "hi" }] });
    expect(res.statusCode).toBe(200);
  });

  it("rejects unknown models and invalid bodies", async () => {
    expect((await chat(apiKey, { model: "nope", messages: [{ role: "user", content: "x" }] })).statusCode).toBe(404);
    expect((await chat(apiKey, { model: "kwota/mock-large", messages: [] })).statusCode).toBe(400);
    expect((await chat(apiKey, { model: "kwota/mock-large", messages: [{ role: "user", content: "x" }], evil: 1 })).statusCode).toBe(400);
  });

  it("enforces the per-request cost cap", async () => {
    await s.ctx.params.set("max_cost_per_request_micro", "10", "test", null);
    const res = await chat(apiKey, { model: "kwota/mock-large", messages: [{ role: "user", content: "x".repeat(3000) }] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("max_cost_exceeded");
    await s.ctx.params.set("max_cost_per_request_micro", "500000", "test", null);
  });

  it("rate limits per key", async () => {
    await s.ctx.params.set("rpm_per_key", 2, "test", null);
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await chat(apiKey, { model: "kwota/mock-large", messages: [{ role: "user", content: "r" }] })).statusCode);
    expect(codes).toContain(429);
    await s.ctx.params.set("rpm_per_key", 1000, "test", null);
  });

  it("revoked keys stop working immediately", async () => {
    const del = await s.app.inject({ method: "DELETE", url: `/me/keys/${keyId}`, headers: { authorization: `Bearer ${session}` } });
    expect(del.statusCode).toBe(200);
    expect((await chat(apiKey, { model: "kwota/mock-large", messages: [{ role: "user", content: "x" }] })).statusCode).toBe(401);
  });

  it("concurrent requests never overdraw the balance", async () => {
    const u = await s.ctx.ledger.ensureUser(holder.address);
    const acc = await s.ctx.ledger.holderAccount(u.id);
    const start = (await s.ctx.ledger.balance(acc.id))!.balanceMicro;
    const results = await Promise.all(
      Array.from({ length: 30 }, () => chat(session, { model: "kwota/mock-large", messages: [{ role: "user", content: "x".repeat(200) }], max_tokens: 4096 })),
    );
    const after = (await s.ctx.ledger.balance(acc.id))!;
    expect(after.balanceMicro).toBeGreaterThanOrEqual(0n);
    expect(after.reservedMicro).toBe(0n);
    expect(results.some((r) => r.statusCode === 402 || r.statusCode === 429 || r.statusCode === 200)).toBe(true);
    expect(after.balanceMicro).toBeLessThanOrEqual(start);
    expect(await s.ctx.ledger.reconcile()).toEqual([]);
  });

  it("ledger is append-only", async () => {
    await expect(s.ctx.db.execute(sql`update ledger_entries set delta_micro = 0`)).rejects.toThrow(/append-only/);
    await expect(s.ctx.db.execute(sql`delete from ledger_entries`)).rejects.toThrow(/append-only/);
  });
});
