/**
 * Independent epoch verifier.
 *
 *   pnpm --filter @kwota/api verify-epoch -- --api https://api.example --epoch 12 [--rpc https://rpc --from-block 123]
 *
 * 1. Downloads the published snapshot and checks its sha256 + Merkle root.
 * 2. With --rpc, rebuilds every holder's TWAB directly from on-chain Transfer
 *    logs and checks allocations match the snapshot exactly.
 */
import { createPublicClient, http } from "viem";
import { allocateEpoch, computeTwab, epochRoot, serializeSnapshot, sortTransfers, type EpochSnapshot, type TransferEvent } from "@kwota/core";
import { TRANSFER_EVENT } from "../indexer/indexer";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const api = arg("api") ?? "http://localhost:8787";
const epochId = Number(arg("epoch"));
if (!epochId) throw new Error("--epoch is required");

const res = await fetch(`${api}/public/epochs/${epochId}/snapshot`);
if (!res.ok) throw new Error(`snapshot fetch failed: ${res.status}`);
const text = await res.text();
const snap = JSON.parse(text) as EpochSnapshot;
const meta = (await (await fetch(`${api}/public/epochs/${epochId}`)).json()) as { snapshotSha256: string; merkleRoot: string | null };

const { sha256 } = serializeSnapshot(snap);
console.log(`sha256      ${sha256 === meta.snapshotSha256 ? "OK " : "BAD"} ${sha256}`);
const allocs = snap.allocations.map((a) => ({ address: a.address, twab: BigInt(a.twab), balanceSeconds: BigInt(a.balanceSeconds), sharePpm: a.sharePpm, kwotaMicro: BigInt(a.kwotaMicro) }));
const root = epochRoot(epochId, allocs);
console.log(`merkle root ${root === meta.merkleRoot && root === snap.merkleRoot ? "OK " : "BAD"} ${root}`);
const sum = allocs.reduce((s, a) => s + a.kwotaMicro, 0n);
console.log(`budget      ${sum + BigInt(snap.dustMicro) === BigInt(snap.budgetMicro) ? "OK " : "BAD"} distributed=${sum} dust=${snap.dustMicro}`);

const rpc = arg("rpc");
if (rpc) {
  const client = createPublicClient({ transport: http(rpc) });
  const fromBlock = BigInt(arg("from-block") ?? "0");
  const toBlock = BigInt(snap.endBlock);
  const events: TransferEvent[] = [];
  const times = new Map<bigint, number>();
  for (let b = fromBlock; b <= toBlock; b += 5000n) {
    const end = b + 4999n < toBlock ? b + 4999n : toBlock;
    const logs = await client.getLogs({ address: snap.token as `0x${string}`, event: TRANSFER_EVENT, fromBlock: b, toBlock: end, strict: true });
    for (const l of logs) {
      if (!times.has(l.blockNumber)) times.set(l.blockNumber, Number((await client.getBlock({ blockNumber: l.blockNumber })).timestamp));
      events.push({ from: l.args.from.toLowerCase(), to: l.args.to.toLowerCase(), amount: l.args.value, timestamp: times.get(l.blockNumber)!, blockNumber: l.blockNumber, logIndex: l.logIndex });
    }
  }
  const opening = new Map<string, bigint>();
  for (const t of sortTransfers(events.filter((e) => e.timestamp < snap.start))) {
    if (t.from !== "0x0000000000000000000000000000000000000000") opening.set(t.from, (opening.get(t.from) ?? 0n) - t.amount);
    if (t.to !== "0x0000000000000000000000000000000000000000") opening.set(t.to, (opening.get(t.to) ?? 0n) + t.amount);
  }
  for (const [k, v] of opening) if (v === 0n) opening.delete(k);
  const window = events.filter((e) => e.timestamp >= snap.start && e.timestamp < snap.end);
  const twabs = computeTwab({ openingBalances: opening, transfers: window, start: snap.start, end: snap.end });
  const p = snap.params as { min_holding_raw: string; min_holding_mode: "twab" | "min_balance" };
  const r = allocateEpoch(twabs.values(), { budgetMicro: BigInt(snap.budgetMicro), minHoldingRaw: BigInt(p.min_holding_raw), minHoldingMode: p.min_holding_mode, excluded: new Set(snap.excluded) });
  const ok = epochRoot(epochId, r.allocations) === snap.merkleRoot;
  console.log(`on-chain    ${ok ? "OK " : "BAD"} recomputed ${r.allocations.length} allocations from ${events.length} transfers`);
  if (!ok) process.exitCode = 1;
}
