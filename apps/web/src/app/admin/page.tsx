"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { parseUnits, formatUnits } from "viem";
import { useSignTypedData } from "wagmi";
import { ADMIN_ACTION_TYPES, adminDomain } from "@kwota/core/agentAuth";
import { Badge, Button, Card, Empty, ErrorNote, Input } from "@/components/ui";
import { SignInGate } from "@/components/SignInGate";
import { api } from "@/lib/api";
import { config, explorerTx } from "@/lib/config";
import { useDemo } from "@/lib/apiMode";
import { dateTime, kwota, short, token } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function useAdminAction() {
  const { signTypedDataAsync } = useSignTypedData();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, path, payload }: { action: string; path: string; payload: unknown }) => {
      const p = JSON.stringify(payload);
      const nonce = crypto.randomUUID();
      const issuedAt = Math.floor(Date.now() / 1000);
      const signature = await signTypedDataAsync({
        domain: adminDomain(config.chainId),
        types: ADMIN_ACTION_TYPES,
        primaryType: "AdminAction",
        message: { action, payload: p, nonce, issuedAt: BigInt(issuedAt) },
      });
      return api(path, { method: "POST", json: { action, payload: p, nonce, issuedAt, signature } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export default function AdminPage() {
  const demoMode = useDemo();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-fog-100">Admin</h1>
        <p className="mt-1 text-sm text-fog">Every change is signed by your admin wallet (EIP-712) and written to the audit log. The server holds no keys.</p>
      </div>
      {demoMode ? (
        <Card className="mx-auto max-w-xl text-center">
          <h2 className="text-xl font-medium text-fog-100">Admin goes live with the API</h2>
          <p className="mt-2 text-sm text-fog">
            The dashboard edits real parameters, verifies swaps on-chain and publishes epochs, so it only runs against the KWOTA API with your
            admin wallet. Set <code>NEXT_PUBLIC_API_URL</code> and <code>ADMIN_ADDRESSES</code> to enable it.
          </p>
        </Card>
      ) : (
        <SignInGate>
          <AdminInner />
        </SignInGate>
      )}
    </div>
  );
}

function AdminInner() {
  const state = useQuery({ queryKey: ["admin"], queryFn: () => api<Any>("/admin/state"), retry: false });
  const act = useAdminAction();
  if (state.error) return <ErrorNote error={state.error} />;
  if (!state.data) return <Card>Loading…</Card>;
  const s = state.data;
  return (
    <div className="space-y-4">
      {act.error && <ErrorNote error={act.error} />}
      {act.isSuccess && <div className="rounded-xl border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-volt">Signed & applied.</div>}
      {s.ledgerMismatches?.length > 0 && <div className="rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">Ledger mismatch on {s.ledgerMismatches.length} account(s) — investigate before publishing epochs.</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <ParamsCard params={s.params} act={act} />
        <EpochsCard epochs={s.epochs} act={act} autoPublish={s.env.autoPublish} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SwapCard swaps={s.swaps} act={act} />
        <TopupCard topups={s.topups} act={act} />
      </div>
      <InflowsCard inflows={s.inflows} act={act} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ExclusionsCard rows={s.exclusions} act={act} />
        <RegistryCard rows={s.registries} act={act} />
      </div>
      {s.env.allowAdjust && <AdjustCard act={act} />}
      <ModelsCard rows={s.models} act={act} />
      <Card title="Audit log">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <tbody>
              {s.audit.map((a: Any) => (
                <tr key={a.id} className="border-b border-line/60 align-top">
                  <td className="py-2 pr-3 text-fog">{dateTime(a.createdAt)}</td>
                  <td className="py-2 pr-3 font-mono text-fog-100">{a.action}</td>
                  <td className="py-2 pr-3 font-mono text-fog">{short(a.actor)}</td>
                  <td className="py-2 font-mono text-fog break-all">{JSON.stringify(a.after)?.slice(0, 160)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

type Act = ReturnType<typeof useAdminAction>;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-fog">{label}</span>
      {children}
    </label>
  );
}

function ParamsCard({ params, act }: { params: Any; act: Act }) {
  const [f, setF] = useState<Any>({});
  useEffect(() => {
    setF({
      pool: params.fee_split.poolBps / 100, vault: params.fee_split.vaultBps / 100, ops: params.fee_split.opsBps / 100,
      minHolding: formatUnits(BigInt(params.min_holding_raw), 18), mode: params.min_holding_mode, epochHours: params.epoch_seconds / 3600,
      distribute: params.epoch_distribute_bps / 100, expiry: params.kwota_expiry_epochs, maxCost: Number(params.max_cost_per_request_micro) / 1e6,
      maxOut: params.max_output_tokens, rpmKey: params.rpm_per_key, rpmWallet: params.rpm_per_wallet, maxAgents: params.max_agents_per_holder,
    });
  }, [params]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    const toBps = (v: string | number) => Math.round(Number(v) * 100);
    act.mutate({
      action: "set_params",
      path: "/admin/params",
      payload: {
        fee_split: { poolBps: toBps(f.pool), vaultBps: toBps(f.vault), opsBps: toBps(f.ops) },
        min_holding_raw: parseUnits(String(f.minHolding || "0"), 18).toString(),
        min_holding_mode: f.mode,
        epoch_seconds: Math.round(Number(f.epochHours) * 3600),
        epoch_distribute_bps: toBps(f.distribute),
        kwota_expiry_epochs: Number(f.expiry),
        max_cost_per_request_micro: String(Math.round(Number(f.maxCost) * 1e6)),
        max_output_tokens: Number(f.maxOut),
        rpm_per_key: Number(f.rpmKey),
        rpm_per_wallet: Number(f.rpmWallet),
        max_agents_per_holder: Number(f.maxAgents),
      },
    });
  };
  return (
    <Card title="Parameters">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Pool %"><Input value={f.pool ?? ""} onChange={set("pool")} /></Field>
        <Field label="Vault %"><Input value={f.vault ?? ""} onChange={set("vault")} /></Field>
        <Field label="Ops %"><Input value={f.ops ?? ""} onChange={set("ops")} /></Field>
        <Field label="Min holding (KWOTA)"><Input value={f.minHolding ?? ""} onChange={set("minHolding")} /></Field>
        <Field label="Min holding mode">
          <select className="w-full rounded-xl border border-line bg-ink-900 px-3 py-2 text-sm text-fog-100" value={f.mode} onChange={set("mode")}>
            <option value="twab">time-weighted avg</option>
            <option value="min_balance">never below</option>
          </select>
        </Field>
        <Field label="Epoch (hours)"><Input value={f.epochHours ?? ""} onChange={set("epochHours")} /></Field>
        <Field label="Budget % / epoch"><Input value={f.distribute ?? ""} onChange={set("distribute")} /></Field>
        <Field label="Expiry (epochs)"><Input value={f.expiry ?? ""} onChange={set("expiry")} /></Field>
        <Field label="Max kwota / request"><Input value={f.maxCost ?? ""} onChange={set("maxCost")} /></Field>
        <Field label="Max output tokens"><Input value={f.maxOut ?? ""} onChange={set("maxOut")} /></Field>
        <Field label="RPM / key"><Input value={f.rpmKey ?? ""} onChange={set("rpmKey")} /></Field>
        <Field label="RPM / wallet"><Input value={f.rpmWallet ?? ""} onChange={set("rpmWallet")} /></Field>
      </div>
      <p className="mt-3 text-xs text-fog">Epoch length changes apply from the next scheduled epoch. Split changes apply to new inflows.</p>
      <Button className="mt-4" onClick={submit} disabled={act.isPending}>Sign & save parameters</Button>
    </Card>
  );
}

function EpochsCard({ epochs, act, autoPublish }: { epochs: Any[]; act: Act; autoPublish: boolean }) {
  const [tx, setTx] = useState<Record<number, string>>({});
  return (
    <Card title="Epochs" action={<Badge tone={autoPublish ? "volt" : "amber"}>{autoPublish ? "auto-publish" : "manual publish"}</Badge>}>
      <ul className="divide-y divide-line/60">
        {epochs.map((e: Any) => (
          <li key={e.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-fog-100">#{e.id}</span> <Badge tone={e.status === "published" ? "volt" : e.status === "computed" ? "amber" : "neutral"}>{e.status}</Badge>
                <span className="ml-2 text-fog">{dateTime(e.startTime)} → {dateTime(e.endTime)}</span>
              </div>
              <div className="flex gap-2">
                {e.status !== "published" && e.endTime * 1000 < Date.now() && (
                  <Button variant="ghost" onClick={() => act.mutate({ action: "compute_epoch", path: "/admin/epochs/compute", payload: { epochId: e.id } })}>Compute</Button>
                )}
                {e.status === "computed" && <Button onClick={() => act.mutate({ action: "publish_epoch", path: "/admin/epochs/publish", payload: { epochId: e.id } })}>Publish</Button>}
              </div>
            </div>
            {e.merkleRoot && (
              <div className="mt-1 font-mono text-xs text-fog">
                budget {kwota(e.budgetMicro)} · {e.eligibleCount} holders · root {short(e.merkleRoot, 8)}
              </div>
            )}
            {e.status === "published" && (
              <div className="mt-2 flex gap-2">
                <Input placeholder="Root posting tx hash (optional)" value={tx[e.id] ?? ""} onChange={(ev) => setTx({ ...tx, [e.id]: ev.target.value })} />
                <Button variant="ghost" disabled={!tx[e.id]} onClick={() => act.mutate({ action: "record_epoch_tx", path: "/admin/epochs/onchain", payload: { epochId: e.id, txHash: tx[e.id] } })}>Save</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!epochs.length && <Empty>No epochs yet — the worker creates them from the genesis time.</Empty>}
    </Card>
  );
}

function SwapCard({ swaps, act }: { swaps: Any[]; act: Act }) {
  const [f, setF] = useState({ txHash: "", bucket: "pool", note: "" });
  return (
    <Card title="Record swap / transfer">
      <p className="mb-3 text-xs text-fog">Execute the swap from your own wallet first, then paste the tx hash. The server verifies the receipt (sender, destination wallet, token) before recording.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <Input placeholder="0x… tx hash" value={f.txHash} onChange={(e) => setF({ ...f, txHash: e.target.value.trim() })} />
        <select className="rounded-xl border border-line bg-ink-900 px-3 py-2 text-sm text-fog-100" value={f.bucket} onChange={(e) => setF({ ...f, bucket: e.target.value })}>
          <option value="pool">pool</option>
          <option value="vault">vault</option>
          <option value="ops">ops</option>
        </select>
      </div>
      <Input className="mt-2" placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <Button className="mt-3" disabled={!/^0x[0-9a-fA-F]{64}$/.test(f.txHash) || act.isPending} onClick={() => act.mutate({ action: "record_swap", path: "/admin/swaps", payload: { txHash: f.txHash, bucket: f.bucket, note: f.note || undefined } })}>Verify & record</Button>
      <ul className="mt-4 divide-y divide-line/60 text-xs">
        {swaps.slice(0, 8).map((s: Any) => (
          <li key={s.id} className="flex justify-between py-2">
            <span><Badge>{s.bucket}</Badge> <span className="ml-1 font-mono text-fog-100">{s.bucket === "pool" ? `$${kwota(s.poolCreditMicro)}` : token(s.toAmount)}</span></span>
            <a className="font-mono text-fog" href={explorerTx(s.txHash)} target="_blank" rel="noreferrer">{short(s.txHash)}</a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TopupCard({ topups, act }: { topups: Any[]; act: Act }) {
  const [f, setF] = useState({ provider: "openrouter", amount: "", proofRef: "", note: "" });
  return (
    <Card title="Record provider top-up">
      <p className="mb-3 text-xs text-fog">When pool funds are moved to the model provider (bridge + credit purchase), record the amount and a proof reference (tx hash / invoice id).</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="provider" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} />
        <Input placeholder="amount USD" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input placeholder="proof ref" value={f.proofRef} onChange={(e) => setF({ ...f, proofRef: e.target.value })} />
      </div>
      <Button className="mt-3" disabled={!f.amount || !f.proofRef || act.isPending} onClick={() => act.mutate({ action: "record_topup", path: "/admin/topups", payload: { ...f, note: f.note || undefined } })}>Sign & record</Button>
      <ul className="mt-4 divide-y divide-line/60 text-xs">
        {topups.slice(0, 6).map((t: Any) => (
          <li key={t.id} className="flex justify-between py-2"><span className="text-fog-100">{t.provider} · ${kwota(t.amountMicro)}</span><span className="font-mono text-fog">{t.proofRef.slice(0, 18)}</span></li>
        ))}
      </ul>
    </Card>
  );
}

function InflowsCard({ inflows, act }: { inflows: Any[]; act: Act }) {
  return (
    <Card title="Treasury inflows (dev wallet)">
      {inflows.length ? (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <tbody>
              {inflows.map((i: Any) => (
                <tr key={i.id} className="border-b border-line/60">
                  <td className="py-2 pr-2 text-fog">{dateTime(i.blockTime)}</td>
                  <td className="py-2 pr-2 font-mono text-fog-100">{token(i.amount)} {i.token === config.ant ? "ANT" : short(i.token)}</td>
                  <td className="py-2 pr-2 font-mono text-fog">from {short(i.from)}</td>
                  <td className="py-2 pr-2"><Badge tone={i.classification === "fee" ? "volt" : "amber"}>{i.classification}</Badge></td>
                  <td className="py-2 text-right">
                    <button
                      className="text-fog underline decoration-dotted hover:text-fog-100"
                      onClick={() => {
                        const note = prompt(i.classification === "fee" ? "Why is this NOT a fee? (shown publicly)" : "Reason to mark as fee again");
                        if (note) act.mutate({ action: "classify_inflow", path: "/admin/inflows/classify", payload: { id: String(i.id), classification: i.classification === "fee" ? "non_fee" : "fee", note } });
                      }}
                    >
                      mark {i.classification === "fee" ? "non-fee" : "fee"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No inflows indexed yet</Empty>
      )}
    </Card>
  );
}

function ExclusionsCard({ rows, act }: { rows: Any[]; act: Act }) {
  const [f, setF] = useState({ address: "", reason: "blacklist", note: "" });
  return (
    <Card title="Excluded addresses & blacklist">
      <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
        <Input placeholder="0x… address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value.trim() })} />
        <select className="rounded-xl border border-line bg-ink-900 px-3 py-2 text-sm text-fog-100" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
          {["blacklist", "lp", "protocol", "treasury", "vault", "ops", "burn"].map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <Input className="mt-2" placeholder="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <Button className="mt-3" disabled={!/^0x[0-9a-fA-F]{40}$/.test(f.address)} onClick={() => act.mutate({ action: "add_exclusion", path: "/admin/exclusions", payload: { address: f.address, reason: f.reason, note: f.note || undefined } })}>Sign & add</Button>
      <ul className="mt-4 max-h-56 divide-y divide-line/60 overflow-y-auto text-xs">
        {rows.map((r: Any) => (
          <li key={r.address} className="flex items-center justify-between py-2">
            <span className={r.active ? "font-mono text-fog-100" : "font-mono text-fog line-through"}>{short(r.address, 6)} <Badge>{r.reason}</Badge></span>
            {r.active && <button className="text-fog hover:text-danger" onClick={() => act.mutate({ action: "remove_exclusion", path: "/admin/exclusions/remove", payload: { address: r.address } })}>remove</button>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-fog">Wallets set in server config (treasury, pool, vault, ops, LP) are always excluded.</p>
    </Card>
  );
}

function RegistryCard({ rows, act }: { rows: Any[]; act: Act }) {
  const [f, setF] = useState({ address: "", name: "" });
  return (
    <Card title="ERC-8004 registries">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Registry address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value.trim() })} />
        <Input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <Button className="mt-3" disabled={!/^0x[0-9a-fA-F]{40}$/.test(f.address) || !f.name} onClick={() => act.mutate({ action: "upsert_registry", path: "/admin/registries", payload: { ...f, enabled: true } })}>Sign & save</Button>
      <ul className="mt-4 divide-y divide-line/60 text-xs">
        {rows.map((r: Any) => (
          <li key={r.id} className="flex justify-between py-2"><span className="text-fog-100">{r.name}</span><span className="font-mono text-fog">{short(r.address, 6)} {r.enabled ? "" : "(off)"}</span></li>
        ))}
      </ul>
    </Card>
  );
}

function AdjustCard({ act }: { act: Act }) {
  const [f, setF] = useState({ address: "", amount: "", note: "" });
  return (
    <Card title="Credit tester kwota (testnet only)">
      <p className="mb-3 text-xs text-fog">Adds (or with a minus sign removes) kwota for a wallet. Signed, audited and visible in the ledger. Disable with ALLOW_ADMIN_ADJUST=false on mainnet.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_1fr_auto]">
        <Input placeholder="0x… wallet" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value.trim() })} />
        <Input placeholder="amount, e.g. 5" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.trim() })} />
        <Input placeholder="note (required)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <Button disabled={!/^0x[0-9a-fA-F]{40}$/.test(f.address) || !/^-?\d+(\.\d{1,6})?$/.test(f.amount) || f.note.length < 3 || act.isPending} onClick={() => act.mutate({ action: "adjust_balance", path: "/admin/adjust", payload: f })}>Sign & credit</Button>
      </div>
    </Card>
  );
}

function ModelsCard({ rows, act }: { rows: Any[]; act: Act }) {
  const blank = { id: "", provider: "openrouter", providerModelId: "", displayName: "", contextLength: "", inputPricePerMTok: "", outputPricePerMTok: "", markupBps: "0", enabled: true, sortOrder: "0" };
  const [f, setF] = useState<Any>(blank);
  const edit = (m: Any) => setF({ ...m, contextLength: m.contextLength ?? "", inputPricePerMTok: (Number(m.inputPriceMicroPerMTok) / 1e6).toString(), outputPricePerMTok: (Number(m.outputPriceMicroPerMTok) / 1e6).toString(), markupBps: String(m.markupBps), sortOrder: String(m.sortOrder) });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card title="Models & prices (USD = kwota per 1M tokens)">
      <div className="grid gap-2 md:grid-cols-4">
        <Input placeholder="public id (e.g. openai/gpt-4o-mini)" value={f.id} onChange={set("id")} />
        <Input placeholder="provider" value={f.provider} onChange={set("provider")} />
        <Input placeholder="provider model id" value={f.providerModelId} onChange={set("providerModelId")} />
        <Input placeholder="display name" value={f.displayName} onChange={set("displayName")} />
        <Input placeholder="context length" value={f.contextLength} onChange={set("contextLength")} />
        <Input placeholder="input $/1M" value={f.inputPricePerMTok} onChange={set("inputPricePerMTok")} />
        <Input placeholder="output $/1M" value={f.outputPricePerMTok} onChange={set("outputPricePerMTok")} />
        <Input placeholder="markup bps" value={f.markupBps} onChange={set("markupBps")} />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-fog"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> enabled</label>
        <Button
          disabled={!f.id || !f.providerModelId || !f.displayName || act.isPending}
          onClick={() =>
            act.mutate({
              action: "upsert_model",
              path: "/admin/models",
              payload: {
                id: f.id, provider: f.provider, providerModelId: f.providerModelId, displayName: f.displayName, contextLength: f.contextLength ? Number(f.contextLength) : null,
                inputPricePerMTok: String(f.inputPricePerMTok), outputPricePerMTok: String(f.outputPricePerMTok), markupBps: Number(f.markupBps), enabled: f.enabled, sortOrder: Number(f.sortOrder),
              },
            })
          }
        >
          Sign & save model
        </Button>
        <button className="text-sm text-fog" onClick={() => setF(blank)}>clear</button>
      </div>
      <table className="mt-4 w-full text-left text-xs">
        <tbody>
          {rows.map((m: Any) => (
            <tr key={m.id} className="border-b border-line/60">
              <td className="py-2 font-mono text-fog-100">{m.id}</td>
              <td className="py-2 text-fog">{m.provider} · {m.providerModelId}</td>
              <td className="py-2 font-mono text-fog">${(Number(m.inputPriceMicroPerMTok) / 1e6).toFixed(2)} / ${(Number(m.outputPriceMicroPerMTok) / 1e6).toFixed(2)}</td>
              <td className="py-2">{m.enabled ? <Badge tone="volt">on</Badge> : <Badge>off</Badge>}</td>
              <td className="py-2 text-right"><button className="text-fog underline decoration-dotted" onClick={() => edit(m)}>edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
