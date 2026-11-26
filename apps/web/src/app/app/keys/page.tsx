"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, Copy, Empty, ErrorNote, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { config } from "@/lib/config";
import { dateTime, kwota } from "@/lib/format";

interface Key { id: number; name: string; prefix: string; agentId: number | null; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; maxCostPerRequestMicro: string | null }

export default function Keys() {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ["keys"], queryFn: () => api<Key[]>("/me/keys") });
  const [name, setName] = useState("");
  const [maxCost, setMaxCost] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api<{ key: string }>("/me/keys", { method: "POST", json: { name: name || "default", ...(maxCost ? { maxCostPerRequest: maxCost } : {}) } }),
    onSuccess: (r) => {
      setCreated(r.key);
      setName("");
      setMaxCost("");
      qc.invalidateQueries({ queryKey: ["keys"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api(`/me/keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });

  return (
    <div className="space-y-4">
      <Card title="Create API key">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_200px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input placeholder="Key name, e.g. laptop" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
          <Input placeholder="Max kwota / request (opt.)" value={maxCost} onChange={(e) => setMaxCost(e.target.value)} inputMode="decimal" />
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create key"}</Button>
        </form>
        <div className="mt-3"><ErrorNote error={create.error} /></div>
        {created && (
          <div className="mt-4 rounded-xl border border-volt/40 bg-volt/10 p-4">
            <div className="text-sm text-volt">Copy this key now — it will not be shown again.{created.startsWith("kw_demo_") && " Demo key — create a new one once the live API is connected."}</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-fog-100">{created}</code>
              <Copy text={created} />
            </div>
          </div>
        )}
      </Card>

      <Card title="Your keys">
        {keys.data?.length ? (
          <ul className="divide-y divide-line/60">
            {keys.data.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-fog-100">{k.name}</span>
                    {k.agentId && <Badge tone="amber">agent {k.agentId}</Badge>}
                    {k.revokedAt ? <Badge tone="danger">revoked</Badge> : <Badge tone="volt">active</Badge>}
                  </div>
                  <div className="mt-1 font-mono text-xs text-fog">
                    kw_live_{k.prefix}_•••• · created {dateTime(k.createdAt)} · last used {dateTime(k.lastUsedAt)}
                    {k.maxCostPerRequestMicro && ` · max ${kwota(k.maxCostPerRequestMicro)}/req`}
                  </div>
                </div>
                {!k.revokedAt && (
                  <Button variant="danger" onClick={() => confirm(`Revoke "${k.name}"? Apps using it stop working immediately.`) && revoke.mutate(k.id)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No API keys yet</Empty>
        )}
      </Card>

      <Card title="Quick start">
        <pre className="overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs leading-relaxed text-fog-100"><code>{`from openai import OpenAI

client = OpenAI(base_url="${config.apiUrl ?? "https://api.<kwota-domain>"}/v1", api_key="kw_live_…")
r = client.chat.completions.create(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello from my kwota!"}],
)
print(r.choices[0].message.content)`}</code></pre>
      </Card>
    </div>
  );
}
