"use client";
import { useQuery } from "@tanstack/react-query";
import { erc20Abi } from "viem";
import { useReadContract } from "wagmi";
import { Badge, Card, Empty, Stat } from "@/components/ui";
import { Meter } from "@/components/Meter";
import { api } from "@/lib/api";
import { config } from "@/lib/config";
import { countdown, dateTime, kwota, token } from "@/lib/format";
import { useSession } from "@/lib/session";

interface Me {
  address: string;
  isAdmin: boolean;
  kwota: { balanceMicro: string; reservedMicro: string; availableMicro: string };
  indexedTokenBalanceRaw: string;
  estimate: { epochId: number; estimateMicro: string; sharePpm: number; projectedBudgetMicro: string; endsAt: number };
}
interface LedgerRow { id: string; deltaMicro: string; kind: string; refType: string | null; refId: string | null; balanceAfterMicro: string; createdAt: string; accountType: string; agentId: number | null }

const kindLabel: Record<string, string> = {
  epoch_credit: "Epoch kwota", usage_debit: "AI usage", allocation_out: "Allocated to agent", allocation_in: "Allocation received",
  reclaim_out: "Reclaimed from agent", reclaim_in: "Reclaimed", admin_adjust: "Adjustment", expiry: "Expired", onchain_claim: "Claimed on-chain", onchain_deposit: "Deposited",
};

export default function AppHome() {
  const { address, signOut } = useSession();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me"), refetchInterval: 20_000 });
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => api<LedgerRow[]>("/me/ledger?limit=50"), refetchInterval: 30_000 });
  const bal = useReadContract({
    address: config.token, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined,
    query: { enabled: !!config.token && !!address && !!config.rpcUrl },
  });

  const avail = Number(me.data?.kwota.availableMicro ?? 0);
  const est = Number(me.data?.estimate.estimateMicro ?? 0);
  const tokenBal = bal.data?.toString() ?? me.data?.indexedTokenBalanceRaw;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Card title="Your kwota" className="flex flex-col items-center">
          <Meter value={avail} max={Math.max(avail + est, 1)} label={kwota(me.data?.kwota.availableMicro)} sub="kwota available" size={250} />
          <p className="mt-3 text-center text-xs text-fog">1 kwota = $1 of AI usage · arc shows balance vs. balance + next epoch</p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><Stat label="$KWOTA balance" value={token(tokenBal)} unit="KWOTA" hint={config.token ? (bal.data !== undefined ? "on-chain" : "indexed") : "token address set at launch"} /></Card>
          <Card><Stat label={`Estimated · epoch #${me.data?.estimate.epochId ?? "—"}`} value={`+${kwota(me.data?.estimate.estimateMicro)}`} unit="kwota" accent hint={me.data ? `share ${(me.data.estimate.sharePpm / 10_000).toFixed(3)}% · closes in ${countdown(me.data.estimate.endsAt)}` : undefined} /></Card>
          <Card><Stat label="Reserved (in-flight)" value={kwota(me.data?.kwota.reservedMicro)} unit="kwota" hint="held while requests run" /></Card>
          <Card>
            <Stat label="Projected epoch budget" value={kwota(me.data?.estimate.projectedBudgetMicro)} unit="kwota" hint="time-weighted: holding longer = larger share" />
          </Card>
        </div>
      </div>

      <Card title="History" action={<button onClick={signOut} className="text-xs text-fog hover:text-fog-100">sign out</button>}>
        {ledger.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-fog">
                <tr className="border-b border-line">
                  <th className="py-2 font-normal">When</th>
                  <th className="py-2 font-normal">Type</th>
                  <th className="py-2 font-normal">Account</th>
                  <th className="py-2 text-right font-normal">Change</th>
                  <th className="py-2 text-right font-normal">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.data.map((r) => {
                  const d = BigInt(r.deltaMicro);
                  return (
                    <tr key={r.id} className="border-b border-line/60">
                      <td className="py-2 text-fog">{dateTime(r.createdAt)}</td>
                      <td className="py-2 text-fog-100">{kindLabel[r.kind] ?? r.kind}{r.kind === "epoch_credit" && <span className="ml-1 text-fog">#{r.refId}</span>}</td>
                      <td className="py-2">{r.accountType === "agent" ? <Badge tone="amber">agent {r.agentId}</Badge> : <Badge>wallet</Badge>}</td>
                      <td className={`py-2 text-right font-mono ${d >= 0n ? "text-volt" : "text-fog-100"}`}>{d >= 0n ? "+" : ""}{kwota(r.deltaMicro, 4)}</td>
                      <td className="py-2 text-right font-mono text-fog">{kwota(r.balanceAfterMicro, 4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No kwota activity yet. Hold $KWOTA through an epoch to receive your first kwota.</Empty>
        )}
      </Card>
    </div>
  );
}
