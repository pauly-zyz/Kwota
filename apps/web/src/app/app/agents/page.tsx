"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Bar, Button, Card, Copy, Empty, ErrorNote, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { kwota, short } from "@/lib/format";

interface Registry { id: number; name: string; address: string; chainId: number }
interface AgentRow {
  agent: { id: number; agentTokenId: string; name: string | null; agentWallet: string; ownerAddress: string; status: "active" | "stopped" | "frozen"; dailyLimitMicro: string };
  account: { balanceMicro: string; reservedMicro: string } | null;
  registry: Registry;
  spentTodayMicro: string;
}

export default function Agents() {
  const qc = useQueryClient();
  const regs = useQuery({ queryKey: ["registries"], queryFn: () => api<Registry[]>("/agents/registries") });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => api<AgentRow[]>("/me/agents"), refetchInterval: 20_000 });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["agents"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  const [form, setForm] = useState({ registryId: "", agentTokenId: "", name: "", dailyLimit: "1" });
  const register = useMutation({
    mutationFn: () => api("/me/agents", { method: "POST", json: { registryId: Number(form.registryId || regs.data?.[0]?.id), agentTokenId: form.agentTokenId, name: form.name || undefined, dailyLimit: form.dailyLimit } }),
    onSuccess: () => {
      setForm({ ...form, agentTokenId: "", name: "" });
      refresh();
    },
  });

  return (
    <div className="space-y-4">
      <Card title="Register an agent (ERC-8004)">
        <p className="mb-4 text-sm text-fog">
          Your connected wallet must be the owner (<code>ownerOf</code>) of the agent in the registry. The agent signs requests with its agent wallet,
          or uses an API key bound to it.
        </p>
        <form
          className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_140px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            register.mutate();
          }}
        >
          <select
            className="border border-white/10 bg-black px-3 py-2 text-sm text-fog-100"
            value={form.registryId}
            onChange={(e) => setForm({ ...form, registryId: e.target.value })}
          >
            {(regs.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r.name} · {short(r.address)}</option>
            ))}
            {!regs.data?.length && <option value="">No registry configured</option>}
          </select>
          <Input placeholder="Agent ID" value={form.agentTokenId} onChange={(e) => setForm({ ...form, agentTokenId: e.target.value.replace(/\D/g, "") })} required />
          <Input placeholder="Label (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Daily limit" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })} inputMode="decimal" />
          <Button type="submit" disabled={register.isPending || !regs.data?.length}>Register</Button>
        </form>
        <div className="mt-3"><ErrorNote error={register.error} /></div>
      </Card>

      {agents.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {agents.data.map((a) => <AgentCard key={a.agent.id} row={a} onChange={refresh} />)}
        </div>
      ) : (
        <Card><Empty>No agents yet. Register one above to give it its own kwota budget.</Empty></Card>
      )}
    </div>
  );
}

function AgentCard({ row, onChange }: { row: AgentRow; onChange: () => void }) {
  const a = row.agent;
  const [amount, setAmount] = useState("");
  const [limit, setLimit] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: async (op: "allocate" | "reclaim" | "stop" | "resume" | "limit" | "key" | "refresh") => {
      if (op === "allocate") return api(`/me/agents/${a.id}/allocate`, { method: "POST", json: { amount } });
      if (op === "reclaim") return api(`/me/agents/${a.id}/reclaim`, { method: "POST", json: {} });
      if (op === "stop") return api(`/me/agents/${a.id}/stop`, { method: "POST", json: { reclaim: true } });
      if (op === "resume") return api(`/me/agents/${a.id}/resume`, { method: "POST", json: {} });
      if (op === "refresh") return api(`/me/agents/${a.id}/refresh`, { method: "POST", json: {} });
      if (op === "key") {
        const r = await api<{ key: string }>("/me/keys", { method: "POST", json: { name: `agent-${a.agentTokenId}`, agentId: a.id } });
        setKey(r.key);
        return r;
      }
      return api(`/me/agents/${a.id}`, { method: "PATCH", json: { dailyLimit: limit } });
    },
    onSuccess: () => {
      setAmount("");
      setLimit("");
      onChange();
    },
  });
  const spent = Number(row.spentTodayMicro);
  const cap = Number(a.dailyLimitMicro);
  const bal = row.account ? BigInt(row.account.balanceMicro) - BigInt(row.account.reservedMicro) : 0n;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg text-fog-100">{a.name ?? `Agent #${a.agentTokenId}`}</div>
          <div className="mt-1 font-mono text-xs text-fog">#{a.agentTokenId} · {row.registry.name} · wallet {short(a.agentWallet)}</div>
        </div>
        <Badge tone={a.status === "active" ? "volt" : a.status === "frozen" ? "danger" : "amber"}>{a.status}</Badge>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-fog">Allocated balance</div>
          <div className="mt-1 font-mono text-2xl text-fog-100">{kwota(bal)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-fog">Used today</div>
          <div className="mt-1 font-mono text-2xl text-fog-100">{kwota(row.spentTodayMicro)}<span className="text-sm text-fog"> / {kwota(a.dailyLimitMicro)}</span></div>
        </div>
      </div>
      <div className="mt-3"><Bar value={spent} max={cap} tone={spent >= cap ? "amber" : "volt"} /></div>

      {a.status !== "frozen" && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="flex gap-2">
            <Input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <Button onClick={() => run.mutate("allocate")} disabled={!amount || run.isPending || a.status !== "active"}>Allocate</Button>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Daily limit" value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" />
            <Button variant="ghost" onClick={() => run.mutate("limit")} disabled={!limit || run.isPending}>Set</Button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {a.status === "active" ? (
          <Button variant="danger" onClick={() => confirm("Stop this agent and reclaim its remaining kwota?") && run.mutate("stop")}>■ Stop agent</Button>
        ) : a.status === "stopped" ? (
          <Button variant="ghost" onClick={() => run.mutate("resume")}>Resume</Button>
        ) : null}
        <Button variant="ghost" onClick={() => run.mutate("reclaim")} disabled={bal <= 0n}>Reclaim balance</Button>
        <Button variant="ghost" onClick={() => run.mutate("key")} disabled={a.status !== "active"}>New agent key</Button>
        <Button variant="ghost" onClick={() => run.mutate("refresh")}>Re-check owner</Button>
      </div>
      {key && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-volt/40 bg-volt/10 p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-fog-100">{key}</code>
          <Copy text={key} />
        </div>
      )}
      {a.status === "frozen" && <p className="mt-3 text-sm text-danger">Ownership of this agent changed in the registry. It is frozen; reclaim its balance.</p>}
      <div className="mt-3"><ErrorNote error={run.error} /></div>
    </Card>
  );
}
