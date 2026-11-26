"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button, Card, ErrorNote } from "@/components/ui";
import { api, getToken } from "@/lib/api";
import { config } from "@/lib/config";
import { kwota } from "@/lib/format";

interface Msg { role: "user" | "assistant"; content: string; cost?: string }
interface ModelList { data: { id: string; name: string; pricing: { kwota_per_mtok_input: number; kwota_per_mtok_output: number } }[] }

export default function Playground() {
  const qc = useQueryClient();
  const models = useQuery({ queryKey: ["v1models"], queryFn: () => api<ModelList>("/v1/models", { auth: false }) });
  const [model, setModel] = useState("");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!model && models.data?.data[0]) setModel(models.data.data[0].id);
  }, [models.data, model]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function send() {
    if (!input.trim() || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: input.trim() }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${config.apiUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ model, stream: true, max_tokens: 1024, messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let text = "";
      let cost: string | undefined;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const evt = buf.slice(0, i);
          buf = buf.slice(i + 2);
          for (const line of evt.split("\n")) {
            if (line.startsWith(": kwota ")) cost = JSON.parse(line.slice(8)).cost_micro;
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const d = JSON.parse(payload);
              text += d.choices?.[0]?.delta?.content ?? "";
            } catch {
              /* ignore */
            }
          }
          setMsgs([...history, { role: "assistant", content: text, cost }]);
        }
      }
      setMsgs([...history, { role: "assistant", content: text, cost }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e as Error);
        setMsgs(history);
      }
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["me"] });
    }
  }

  const sel = models.data?.data.find((m) => m.id === model);
  const total = msgs.reduce((s, m) => s + (m.cost ? Number(m.cost) : 0), 0);

  return (
    <Card
      title="Playground"
      action={
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-fog sm:inline">session cost {kwota(BigInt(total), 6)} kwota</span>
          <select className="rounded-lg border border-line bg-ink-900 px-2 py-1 text-sm text-fog-100" value={model} onChange={(e) => setModel(e.target.value)}>
            {(models.data?.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      }
    >
      {sel && <div className="mb-3 font-mono text-xs text-fog">{sel.pricing.kwota_per_mtok_input.toFixed(2)} in / {sel.pricing.kwota_per_mtok_output.toFixed(2)} out kwota per 1M tokens</div>}
      <div className="h-[52vh] min-h-[320px] overflow-y-auto rounded-xl border border-line bg-ink-900 p-4">
        {!msgs.length && <div className="flex h-full items-center justify-center text-sm text-fog">Ask anything — every token is metered from your kwota.</div>}
        <div className="space-y-4">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={m.role === "user" ? "max-w-[80%] rounded-2xl bg-ink-600 px-4 py-2 text-fog-100" : "max-w-[90%] whitespace-pre-wrap text-fog-100"}>
                {m.content || (busy && i === msgs.length - 1 ? <span className="animate-pulse text-fog">▍</span> : null)}
                {m.cost && <div className="mt-1 font-mono text-[11px] text-fog">−{kwota(m.cost, 6)} kwota</div>}
              </div>
            </div>
          ))}
        </div>
        <div ref={endRef} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-sm text-fog-100 outline-none focus:border-volt/60"
          rows={1}
          placeholder="Message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {busy ? (
          <Button type="button" variant="ghost" onClick={() => abortRef.current?.abort()}>Stop</Button>
        ) : (
          <Button type="submit" disabled={!input.trim() || !model}>Send</Button>
        )}
      </form>
      <div className="mt-3"><ErrorNote error={error} /></div>
    </Card>
  );
}
