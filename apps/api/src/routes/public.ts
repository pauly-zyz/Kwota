import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { tables } from "@kwota/db";
import { buildEpochTree, proofFor } from "@kwota/core";
import { erc20Abi } from "viem";
import type { Ctx } from "../context";
import { notFound } from "../lib/errors";
import { toJson } from "../lib/json";
import { EpochEngine } from "../epoch/engine";

const q1 = async <T>(ctx: Ctx, s: ReturnType<typeof sql>) => ((await ctx.db.execute(s)) as unknown as T[]);

export async function publicRoutes(app: FastifyInstance, ctx: Ctx) {
  const engine = new EpochEngine(ctx);
  const env = ctx.env;

  app.get("/health", async () => ({ ok: true, ready: true, chainId: env.CHAIN_ID, provider: env.MODEL_PROVIDER === "mock" ? "mock" : "live" }));

  app.get("/public/config", async () => ({
    chainId: env.CHAIN_ID,
    explorerUrl: env.EXPLORER_URL || null,
    token: env.KWOTA_TOKEN_ADDRESS ?? null,
    treasury: env.TREASURY_ADDRESS ?? null,
    poolWallet: env.POOL_WALLET_ADDRESS ?? null,
    vault: env.VAULT_ADDRESS ?? null,
    opsWallet: env.OPS_WALLET_ADDRESS ?? null,
    ant: env.ANT_ADDRESS,
    stableTokens: env.STABLE_TOKEN_ADDRESSES,
    lpPairs: env.LP_PAIR_ADDRESSES,
  }));

  app.get("/public/overview", async () => {
    const cached = await ctx.kv.get("public:overview");
    if (cached) return JSON.parse(cached);
    const p = await ctx.params.all();
    const inflows = await q1<{ token: string; total: string; n: number }>(ctx, sql`select token, sum(amount_raw)::text total, count(*)::int n from treasury_inflows where classification = 'fee' group by token`);
    const buckets = await q1<{ bucket: string; token: string; total: string }>(ctx, sql`select f.bucket, f.token, sum(f.amount_raw)::text total from fee_allocations f join treasury_inflows i on i.id = f.inflow_id where i.classification = 'fee' group by f.bucket, f.token`);
    const [pool] = await q1<{ credited: string; swaps: number }>(ctx, sql`select coalesce(sum(pool_credit_micro),0)::text credited, count(*)::int swaps from swaps where verified and bucket = 'pool'`);
    const [dist] = await q1<{ distributed: string; epochs: number }>(ctx, sql`select coalesce(sum(distributed_micro),0)::text distributed, count(*)::int epochs from epochs where status = 'published'`);
    const [led] = await q1<{ consumed: string; expired: string }>(ctx, sql`select coalesce(-sum(delta_micro) filter (where kind = 'usage_debit'),0)::text consumed, coalesce(-sum(delta_micro) filter (where kind = 'expiry'),0)::text expired from ledger_entries`);
    const [out] = await q1<{ outstanding: string; holders: number }>(ctx, sql`select coalesce(sum(balance_micro),0)::text outstanding, count(*) filter (where balance_micro > 0)::int holders from kwota_accounts`);
    const [top] = await q1<{ topups: string }>(ctx, sql`select coalesce(sum(amount_micro),0)::text topups from provider_topups`);
    const [reqs] = await q1<{ n: number; tokens: string }>(ctx, sql`select count(*)::int n, coalesce(sum(coalesce(input_tokens,0)+coalesce(output_tokens,0)),0)::text tokens from usage_requests where status = 'settled'`);
    const [holders] = await q1<{ n: number }>(ctx, sql`select count(*)::int n from holder_balances where balance_raw > 0`);
    const unallocated = await engine.unallocatedPoolMicro();
    const remainingFunds = BigInt(pool!.credited) - BigInt(led!.consumed);
    const outstanding = BigInt(out!.outstanding);
    let vaultAnt: string | null = null;
    if (ctx.client && env.VAULT_ADDRESS) {
      vaultAnt = (await ctx.client.readContract({ address: env.ANT_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [env.VAULT_ADDRESS] }).catch(() => null))?.toString() ?? null;
    }
    const res = {
      updatedAt: new Date().toISOString(),
      feeSplit: p.fee_split,
      feeInflows: inflows,
      bucketAllocations: buckets,
      pool: {
        creditedMicro: pool!.credited, swaps: pool!.swaps, distributedMicro: dist!.distributed, unallocatedMicro: unallocated.toString(),
        consumedMicro: led!.consumed, expiredMicro: led!.expired, remainingFundsMicro: remainingFunds.toString(), providerTopupsMicro: top!.topups,
      },
      kwota: { outstandingMicro: out!.outstanding, accountsWithBalance: out!.holders, epochsPublished: dist!.epochs, coverageBps: outstanding > 0n ? Number((remainingFunds * 10_000n) / outstanding) : null },
      usage: { requests: reqs!.n, tokens: reqs!.tokens },
      holders: holders!.n,
      vault: { address: env.VAULT_ADDRESS ?? null, antBalanceRaw: vaultAnt },
      params: { epochSeconds: p.epoch_seconds, minHoldingRaw: p.min_holding_raw, minHoldingMode: p.min_holding_mode, distributeBps: p.epoch_distribute_bps, expiryEpochs: p.kwota_expiry_epochs },
    };
    await ctx.kv.set("public:overview", JSON.stringify(res), 30);
    return res;
  });

  app.get("/public/epochs", async () => {
    await engine.ensureSchedule().catch(() => null);
    const rows = await ctx.db
      .select({
        id: tables.epochs.id, startTime: tables.epochs.startTime, endTime: tables.epochs.endTime, status: tables.epochs.status,
        budgetMicro: tables.epochs.budgetMicro, distributedMicro: tables.epochs.distributedMicro, dustOutMicro: tables.epochs.dustOutMicro,
        eligibleCount: tables.epochs.eligibleCount, merkleRoot: tables.epochs.merkleRoot, snapshotSha256: tables.epochs.snapshotSha256,
        onchainTx: tables.epochs.onchainTx, publishedAt: tables.epochs.publishedAt,
      })
      .from(tables.epochs)
      .orderBy(desc(tables.epochs.id))
      .limit(100);
    return toJson(rows);
  });

  app.get("/public/epochs/:id", async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const e = await engine.get(id);
    if (!e) throw notFound("epoch not found");
    const { snapshotJson: _s, ...rest } = e;
    return toJson(rest);
  });

  app.get("/public/epochs/:id/snapshot", async (req, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const e = await engine.get(id);
    if (!e?.snapshotJson) throw notFound("snapshot not available");
    reply.header("content-type", "application/json").header("content-disposition", `inline; filename="kwota-epoch-${id}.json"`);
    return e.snapshotJson;
  });

  app.get("/public/epochs/:id/proof/:address", async (req) => {
    const { id, address } = z.object({ id: z.coerce.number().int(), address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }).parse(req.params);
    const allocs = await ctx.db.select().from(tables.epochAllocations).where(eq(tables.epochAllocations.epochId, id)).orderBy(asc(tables.epochAllocations.address));
    if (!allocs.length) throw notFound("no allocations for epoch");
    const list = allocs.map((a) => ({ address: a.address.toLowerCase(), twab: a.twab, balanceSeconds: a.balanceSeconds, sharePpm: a.sharePpm, kwotaMicro: a.kwotaMicro }));
    const tree = buildEpochTree(id, list);
    const mine = list.find((a) => a.address === address.toLowerCase());
    if (!mine) throw notFound("address not in epoch");
    return toJson({ epochId: id, root: tree.root, leaf: [String(id), mine.address, mine.twab.toString(), mine.kwotaMicro.toString()], proof: proofFor(tree, mine.address) });
  });

  app.get("/public/models", async () => {
    const rows = await ctx.db.select().from(tables.models).where(eq(tables.models.enabled, true)).orderBy(asc(tables.models.sortOrder));
    return toJson(rows.map(({ providerModelId: _p, ...m }) => m));
  });

  app.get("/public/swaps", async () => toJson(await ctx.db.select().from(tables.swaps).orderBy(desc(tables.swaps.id)).limit(200)));
  app.get("/public/topups", async () => toJson(await ctx.db.select().from(tables.providerTopups).orderBy(desc(tables.providerTopups.id)).limit(200)));
  app.get("/public/inflows", async () => toJson(await ctx.db.select().from(tables.treasuryInflows).orderBy(desc(tables.treasuryInflows.id)).limit(200)));
}
