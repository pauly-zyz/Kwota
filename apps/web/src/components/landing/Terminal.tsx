"use client";
import { useEffect, useState } from "react";
import { useApiBase } from "@/lib/apiMode";

const snippets = (base: string) => ({
  python: `from openai import OpenAI

client = OpenAI(base_url="${base}/v1", api_key="kw_live_…")
r = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[{"role": "user", "content": "Plan my day"}],
)
print(r.choices[0].message.content)`,
  javascript: `import OpenAI from "openai";

const kwota = new OpenAI({ baseURL: "${base}/v1", apiKey: "kw_live_…" });
const stream = await kwota.chat.completions.create({
  model: "gpt-5-mini", stream: true,
  messages: [{ role: "user", content: "Write a haiku" }],
});
for await (const c of stream) process.stdout.write(c.choices[0]?.delta?.content ?? "");`,
  curl: `curl ${base}/v1/chat/completions \\
  -H "Authorization: Bearer kw_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"qwen3-235b-a22b-2507",
       "messages":[{"role":"user","content":"hi"}]}'`,
});

export function Terminal() {
  const base = useApiBase();
  const [tab, setTab] = useState<"python" | "javascript" | "curl">("python");
  const full = snippets(base)[tab];
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const iv = setInterval(() => setN((x) => (x >= full.length ? x : x + 3)), 12);
    return () => clearInterval(iv);
  }, [full]);
  return (
    <div className="overflow-hidden border border-white/10 bg-black">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]/80" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]/80" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]/80" />
        <div className="ml-4 flex gap-1">
          {(["python", "javascript", "curl"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-2.5 py-1 font-mono text-xs transition ${tab === t ? "bg-white/10 text-fog-100" : "text-fog hover:text-fog-100"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <pre className="h-[250px] overflow-hidden p-5 text-[12.5px] leading-relaxed text-fog-100">
        <code>
          {full.slice(0, n)}
          <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-volt animate-blink" />
        </code>
      </pre>
      <div className="flex items-center justify-between border-t border-white/5 px-5 py-3 font-mono text-[11px] text-fog">
        <span>OpenAI-compatible · streaming · per-token metering</span>
        <span className="text-volt">200 OK · −0.00031 kwota</span>
      </div>
    </div>
  );
}
