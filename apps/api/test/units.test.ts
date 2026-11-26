import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { originAllowed, domainAllowed, parseOrigins } from "../src/lib/origins";
import { perTokenToMicroPerMTok } from "../src/seedLib";
import { OpenAICompatibleProvider } from "../src/providers/openaiCompatible";

describe("origins", () => {
  const p = parseOrigins("https://kwota*.vercel.app, http://localhost:3000, https://kwota.xyz/");
  it("matches exact and wildcard origins", () => {
    expect(originAllowed(p, "https://kwota.xyz")).toBe(true);
    expect(originAllowed(p, "https://kwota-git-main-pauly.vercel.app")).toBe(true);
    expect(originAllowed(p, "http://localhost:3000")).toBe(true);
    expect(originAllowed(p, "https://evil.vercel.app")).toBe(false);
    expect(originAllowed(p, "https://kwota.vercel.app.evil.com")).toBe(false);
    expect(originAllowed(p, "https://a.b.kwota.vercel.app")).toBe(false);
  });
  it("matches SIWE domains", () => {
    expect(domainAllowed(p, "kwota-abc.vercel.app")).toBe(true);
    expect(domainAllowed(p, "localhost:3000")).toBe(true);
    expect(domainAllowed(p, "evil.com")).toBe(false);
    expect(domainAllowed(["*"], "anything")).toBe(false);
  });
});

describe("provider price import", () => {
  it("converts USD/token to µkwota per 1M tokens, rounding up", () => {
    expect(perTokenToMicroPerMTok("0.0000000700")).toBe(70_000n); // $0.07 / M
    expect(perTokenToMicroPerMTok("0.0000020000")).toBe(2_000_000n); // $2 / M
    expect(perTokenToMicroPerMTok("0.0000000000001")).toBe(1n); // sub-µ rounds up
    expect(perTokenToMicroPerMTok("0")).toBe(0n);
    expect(perTokenToMicroPerMTok("abc")).toBeNull();
    expect(perTokenToMicroPerMTok(undefined)).toBeNull();
  });
});

describe("OpenAI-compatible provider", () => {
  it("streams chunks and reads final usage; no OpenRouter-only fields sent", async () => {
    let body: Record<string, unknown> = {};
    const srv = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        body = JSON.parse(raw);
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(`data: {"id":"x","choices":[{"delta":{"content":"Hel"}}]}\n\n`);
        res.write(`: keep-alive\n\n`);
        res.write(`data: {"id":"x","choices":[{"delta":{"content":"lo"}}]}\n\n`);
        res.write(`data: {"id":"x","choices":[],"usage":{"prompt_tokens":7,"completion_tokens":2}}\n\n`);
        res.end("data: [DONE]\n\n");
      });
    });
    await new Promise<void>((r) => srv.listen(0, r));
    const port = (srv.address() as { port: number }).port;
    const p = new OpenAICompatibleProvider({ id: "surplus", apiKey: "k", baseUrl: `http://127.0.0.1:${port}/v1/`, appName: "KWOTA" });
    const s = await p.chatStream({ model: "m", messages: [{ role: "user", content: "hi" }], max_tokens: 5 });
    let text = "";
    for await (const c of s.chunks) text += ((c.data.choices as { delta?: { content?: string } }[])[0]?.delta?.content) ?? "";
    expect(text).toBe("Hello");
    expect(s.usage()).toEqual({ prompt_tokens: 7, completion_tokens: 2 });
    expect(body.usage).toBeUndefined();
    expect(body.stream_options).toEqual({ include_usage: true });
    srv.close();
  });
});
