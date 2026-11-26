"use client";
import { erc20Abi } from "viem";
import { useReadContract } from "wagmi";
import { Badge, Bar, Card, Empty, Stat } from "@/components/ui";
import { DemoBanner } from "@/components/DemoBanner";
import { Meter } from "@/components/Meter";
import { config, explorerAddr, explorerTx } from "@/lib/config";
import { useDemo } from "@/lib/apiMode";
import { bps, dateTime, kwota, short, token, usd } from "@/lib/format";
import { useEpochs, useModels, useOverview, useSwaps } from "@/lib/hooks";

const tokenName = (a: string | null | undefined) => {
  if (!a) return "—";
  const x = a.toLowerCase();
  if (x === config.ant) return "ANT";
  if (x === "0x0000000000000000000000000000000000000000") return "ETH";
  if (config.token && x === config.token.toLowerCase()) return "KWOTA";
  if (x === "usdg") return "USDG";
  return short(a);
};

export default function Transparency() {
  const demoMode = useDemo();
  const { data: o } = useOverview();
  const { data: epochs } = useEpochs();
  const { data: models } = useModels();
  const { data: swaps } = useSwaps();

  const vaultAddr = config.vault ?? (o?.vault.address as `0x${string}` | null) ?? undefined;
  const onchainVault = useReadContract({
    address: config.ant,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: vaultAddr ? [vaultAddr] : undefined,
    query: { enabled: !!vaultAddr && !!config.rpcUrl && !demoMode },
  });
  const vaultRaw = onchainVault.data?.toString() ?? o?.vault.antBalanceRaw ?? null;

  const coverage = o?.kwota.coverageBps ?? null;
  const remaining = o ? Number(o.pool.remainingFundsMicro) : 0;
  const credited = o ? Number(o.pool.creditedMicro) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-fog-100 sm:text-4xl">Transparency</h1>
          <p className="mt-2 max-w-2xl text-fog">Every fee, swap, epoch and model price. Updated every 30 seconds.</p>
        </div>
        <div className="font-mono text-xs text-fog">updated {o ? dateTime(o.updatedAt) : "—"}</div>
      </div>
      <DemoBanner />

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Card title="Pool coverage" className="flex flex-col items-center">
          <Meter value={coverage ? Math.min(coverage, 20000) : 0} max={20000} label={coverage === null ? "—" : bps(coverage)} sub="funds ÷ outstanding kwota" size={240} />
          <p className="mt-4 text-center text-xs text-fog">≥ 100% means every unspent kwota is backed by pool funds.</p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><Stat label="Pool funds remaining" value={usd(o?.pool.remainingFundsMicro)} accent hint={<Bar value={remaining} max={credited} />} /></Card>
          <Card><Stat label="Kwota outstanding" value={kwota(o?.kwota.outstandingMicro)} unit="kwota" hint={`${o?.kwota.accountsWithBalance ?? "—"} wallets & agents with balance`} /></Card>
          <Card>
            <Stat
              label="ANT vault"
              value={token(vaultRaw)}
              unit="ANT"
              hint={vaultAddr ? <a className="underline decoration-dotted" href={explorerAddr(vaultAddr)} target="_blank" rel="noreferrer">{short(vaultAddr)} · read on-chain</a> : "vault address announced at launch"}
            />
          </Card>
          <Card><Stat label="Kwota distributed" value={kwota(o?.pool.distributedMicro)} unit="kwota" hint={`${o?.kwota.epochsPublished ?? 0} epochs · ${kwota(o?.pool.consumedMicro)} used`} /></Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card title="Fee inflows (to treasury)">
          {o?.feeInflows.length ? (
            <ul className="space-y-3">
              {o.feeInflows.map((f) => (
                <li key={f.token} className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm text-fog">{tokenName(f.token)}</span>
                  <span className="font-mono text-lg text-fog-100">{token(f.total)}</span>
                  <span className="text-xs text-fog">{f.n} txs</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No fees recorded yet</Empty>
          )}
        </Card>
        <Card title="Fee split">
          {o && (
            <div className="space-y-4">
              {[
                ["Kwota Pool", o.feeSplit.poolBps],
                ["ANT Vault", o.feeSplit.vaultBps],
                ["Operations", o.feeSplit.opsBps],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-fog-100">{k}</span>
                    <span className="font-mono text-fog">{bps(v as number)}</span>
                  </div>
                  <Bar value={v as number} max={10000} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Pool ledger">
          {o && (
            <dl className="space-y-2 text-sm">
              {[
                ["Realized into pool", usd(o.pool.creditedMicro)],
                ["Provider top-ups", usd(o.pool.providerTopupsMicro)],
                ["Distributed as kwota", usd(o.pool.distributedMicro)],
                ["Spent on inference", usd(o.pool.consumedMicro)],
                ["Expired → back to pool", usd(o.pool.expiredMicro)],
                ["Undistributed", usd(o.pool.unallocatedMicro)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-fog">{k}</dt>
                  <dd className="font-mono text-fog-100">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <Card title="Epochs" className="mt-4" action={<span className="font-mono text-xs text-fog">Merkle root = OZ StandardMerkleTree(epochId, holder, twab, kwotaMicro)</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-fog">
              <tr className="border-b border-line">
                <th className="py-2 pr-4 font-normal">#</th>
                <th className="py-2 pr-4 font-normal">Period (UTC)</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 text-right font-normal">Budget</th>
                <th className="py-2 pr-4 text-right font-normal">Holders</th>
                <th className="py-2 pr-4 font-normal">Merkle root</th>
                <th className="py-2 font-normal">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {(epochs ?? []).map((e) => (
                <tr key={e.id} className="border-b border-line/60">
                  <td className="py-2.5 pr-4 font-mono text-fog-100">{e.id}</td>
                  <td className="py-2.5 pr-4 text-fog">{dateTime(e.startTime)} → {dateTime(e.endTime)}</td>
                  <td className="py-2.5 pr-4"><Badge tone={e.status === "published" ? "volt" : e.status === "open" ? "neutral" : "amber"}>{e.status}</Badge></td>
                  <td className="py-2.5 pr-4 text-right font-mono text-fog-100">{e.status === "open" ? "—" : kwota(e.budgetMicro)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-fog">{e.eligibleCount || "—"}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-fog">{e.merkleRoot ? short(e.merkleRoot, 6) : "—"}</td>
                  <td className="py-2.5 font-mono text-xs">
                    {e.merkleRoot && !demoMode ? (
                      <a className="text-volt hover:underline" href={`${config.apiUrl}/public/epochs/${e.id}/snapshot`} target="_blank" rel="noreferrer">json</a>
                    ) : (
                      <span className="text-fog">—</span>
                    )}
                    {e.onchainTx && <a className="ml-2 text-fog hover:underline" href={explorerTx(e.onchainTx)} target="_blank" rel="noreferrer">tx</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Models & prices" action={<span className="text-xs text-fog">kwota per 1M tokens</span>}>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-fog">
              <tr className="border-b border-line">
                <th className="py-2 font-normal">Model</th>
                <th className="py-2 text-right font-normal">Input</th>
                <th className="py-2 text-right font-normal">Output</th>
              </tr>
            </thead>
            <tbody>
              {(models ?? []).map((m) => {
                const k = 1 + m.markupBps / 10_000;
                return (
                  <tr key={m.id} className="border-b border-line/60">
                    <td className="py-2">
                      <div className="text-fog-100">{m.displayName}</div>
                      <div className="font-mono text-xs text-fog">{m.id}</div>
                    </td>
                    <td className="py-2 text-right font-mono text-fog-100">{(Number(m.inputPriceMicroPerMTok) * k / 1e6).toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-fog-100">{(Number(m.outputPriceMicroPerMTok) * k / 1e6).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Swaps & transfers (signed by admin wallet, verified on-chain)">
          {swaps?.length ? (
            <ul className="divide-y divide-line/60">
              {swaps.slice(0, 12).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Badge tone={s.bucket === "pool" ? "volt" : s.bucket === "vault" ? "amber" : "neutral"}>{s.bucket}</Badge>
                    <span className="ml-2 text-fog">{s.fromToken ? `${token(s.fromAmount)} ${tokenName(s.fromToken)} → ` : ""}</span>
                    <span className="font-mono text-fog-100">
                      {s.bucket === "pool" ? usd(s.poolCreditMicro) : `${token(s.toAmount)} ${tokenName(s.toToken)}`}
                    </span>
                  </div>
                  <a className="shrink-0 font-mono text-xs text-fog hover:text-fog-100" href={explorerTx(s.txHash)} target="_blank" rel="noreferrer">
                    {short(s.txHash)}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No swaps recorded yet</Empty>
          )}
        </Card>
      </div>

      <Card title="Rules in force" className="mt-4">
        {o && (
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Epoch length" value={`${o.params.epochSeconds / 3600}h`} />
            <Stat label="Min. holding" value={token(o.params.minHoldingRaw, 18, 0)} unit="KWOTA" hint={o.params.minHoldingMode === "twab" ? "time-weighted average" : "never below"} />
            <Stat label="Budget / epoch" value={bps(o.params.distributeBps)} hint="of undistributed pool" />
            <Stat label="Kwota expiry" value={o.params.expiryEpochs} unit="epochs" />
            <Stat label="Requests served" value={o.usage.requests.toLocaleString("en-US")} hint={`${Number(o.usage.tokens).toLocaleString("en-US")} tokens`} />
          </div>
        )}
        <p className="mt-6 text-xs text-fog">
          Excluded from kwota: LP pair, treasury (dev wallet), pool, vault and ops wallets, burn addresses and the public blacklist. Verify any epoch yourself:
          <code className="ml-1 rounded bg-ink-900 px-1.5 py-0.5 text-fog-100">pnpm verify-epoch -- --api {config.apiUrl ?? "<api>"} --epoch N --rpc &lt;rpc&gt;</code>
        </p>
      </Card>
    </div>
  );
}
