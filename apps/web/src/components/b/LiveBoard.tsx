"use client";
import { useModels, useOverview } from "@/lib/hooks";
import { bps, kwota, usd } from "@/lib/format";

/** Terminal-style live board: protocol stats + model price list. */
export function LiveBoard() {
  const { data: o } = useOverview();
  const { data: models } = useModels();
  const stats: [string, string][] = o
    ? [
        ["pool_funds", usd(o.pool.remainingFundsMicro)],
        ["kwota_outstanding", kwota(o.kwota.outstandingMicro)],
        ["kwota_distributed", kwota(o.pool.distributedMicro)],
        ["coverage", o.kwota.coverageBps === null ? "—" : bps(o.kwota.coverageBps)],
        ["requests_served", o.usage.requests.toLocaleString("en-US")],
        ["fee_split", `${o.feeSplit.poolBps / 100} / ${o.feeSplit.vaultBps / 100} / ${o.feeSplit.opsBps / 100}`],
      ]
    : [];
  return (
    <div className="relative overflow-hidden border hair bg-black">
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="flex items-center justify-between border-b hair px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-fog">
        <span>kwota://live</span>
        <span className="flex items-center gap-2 text-volt">
          <span className="h-1.5 w-1.5 bg-volt animate-pulseGlow" /> streaming
        </span>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="border-b hair p-5 md:border-b-0 md:border-r">
          {stats.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-dashed border-white/5 py-2.5 font-mono text-sm">
              <span className="text-fog">{k}</span>
              <span className="text-fog-100 tabular-nums">{v}</span>
            </div>
          ))}
        </div>
        <div className="p-5">
          <div className="mb-2 flex justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-fog">
            <span>model</span>
            <span>in / out · per 1M</span>
          </div>
          {(models ?? []).slice(0, 7).map((m) => (
            <div key={m.id} className="flex items-baseline justify-between gap-4 border-b border-dashed border-white/5 py-2 font-mono text-sm">
              <span className="truncate text-fog-100">{m.id}</span>
              <span className="shrink-0 text-volt tabular-nums">
                {(Number(m.inputPriceMicroPerMTok) / 1e6).toFixed(2)} / {(Number(m.outputPriceMicroPerMTok) / 1e6).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
