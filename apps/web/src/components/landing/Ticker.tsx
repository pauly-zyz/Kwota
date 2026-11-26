"use client";
import { useModels, useOverview } from "@/lib/hooks";
import { bps, kwota, usd } from "@/lib/format";

/** Stock-ticker strip with live protocol stats + model prices. */
export function Ticker() {
  const { data: o } = useOverview();
  const { data: models } = useModels();
  const items: [string, string][] = o
    ? [
        ["POOL", usd(o.pool.remainingFundsMicro)],
        ["KWOTA OUT", kwota(o.kwota.outstandingMicro)],
        ["DISTRIBUTED", kwota(o.pool.distributedMicro)],
        ["COVERAGE", o.kwota.coverageBps === null ? "—" : bps(o.kwota.coverageBps)],
        ["REQUESTS", o.usage.requests.toLocaleString("en-US")],
        ["SPLIT", `${o.feeSplit.poolBps / 100}/${o.feeSplit.vaultBps / 100}/${o.feeSplit.opsBps / 100}`],
        ["EPOCH", `${o.params.epochSeconds / 3600}H`],
      ]
    : [];
  for (const m of (models ?? []).slice(0, 6)) items.push([m.id.toUpperCase(), `${(Number(m.inputPriceMicroPerMTok) / 1e6).toFixed(2)} / ${(Number(m.outputPriceMicroPerMTok) / 1e6).toFixed(2)}`]);
  if (!items.length) return <div className="h-11" />;
  const row = (
    <div className="flex shrink-0 items-center gap-10 pr-10">
      {items.map(([k, v], i) => (
        <span key={i} className="flex items-center gap-2 whitespace-nowrap font-mono text-xs">
          <span className="text-fog">{k}</span>
          <span className="text-fog-100">{v}</span>
          <span className="text-volt">▲</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="mask-fade-x relative flex h-11 items-center overflow-hidden border-y border-white/5 bg-black/40">
      <div className="flex w-max animate-marquee">
        {row}
        {row}
      </div>
    </div>
  );
}
