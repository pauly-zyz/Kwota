import { decodeEventLog, erc20Abi, type PublicClient } from "viem";
import { tables } from "@kwota/db";
import type { Ctx } from "../context";
import { TRANSFER_EVENT } from "../indexer/indexer";
import { managedWallets } from "../lib/addresses";
import { badRequest } from "../lib/errors";

type Bucket = "pool" | "vault" | "ops";

/** Normalise a raw stable amount to µ-units (6 decimals) = µkwota (1 stable = 1 kwota). */
export function toMicro(amount: bigint, decimals: number): bigint {
  if (decimals === 6) return amount;
  if (decimals > 6) return amount / 10n ** BigInt(decimals - 6);
  return amount * 10n ** BigInt(6 - decimals);
}

/**
 * Verify a swap/transfer the admin executed from their own wallet, then record it.
 * The server never signs anything: it only reads the receipt and checks that
 *  - the tx succeeded and was sent by a managed/admin wallet,
 *  - it delivered tokens to the bucket's wallet,
 *  - pool deliveries are a configured stablecoin, vault deliveries are ANT.
 */
export async function verifyAndRecordSwap(ctx: Ctx, opts: { txHash: `0x${string}`; bucket: Bucket; note?: string; actor: string; client?: PublicClient }) {
  const client = opts.client ?? ctx.client;
  if (!client) throw badRequest("RPC_URL not configured; cannot verify transactions");
  const env = ctx.env;
  const dest = { pool: env.POOL_WALLET_ADDRESS, vault: env.VAULT_ADDRESS, ops: env.OPS_WALLET_ADDRESS }[opts.bucket];
  if (!dest) throw badRequest(`wallet for bucket '${opts.bucket}' is not configured`);

  const receipt = await client.getTransactionReceipt({ hash: opts.txHash }).catch(() => null);
  if (!receipt) throw badRequest("transaction not found");
  if (receipt.status !== "success") throw badRequest("transaction failed on-chain");
  const managed = managedWallets(env);
  if (!managed.has(receipt.from.toLowerCase())) throw badRequest("transaction was not sent by a managed or admin wallet");

  const transfers = receipt.logs.flatMap((l) => {
    try {
      const d = decodeEventLog({ abi: [TRANSFER_EVENT], data: l.data, topics: l.topics, strict: true });
      return [{ token: l.address.toLowerCase(), from: (d.args.from as string).toLowerCase(), to: (d.args.to as string).toLowerCase(), value: d.args.value as bigint }];
    } catch {
      return [];
    }
  });
  const inbound = transfers.filter((t) => t.to === dest);
  if (!inbound.length) throw badRequest(`no token transfer to the ${opts.bucket} wallet in this transaction`);

  let chosen = inbound[0]!;
  let poolCreditMicro = 0n;
  if (opts.bucket === "pool") {
    const stable = inbound.find((t) => env.STABLE_TOKEN_ADDRESSES.includes(t.token));
    if (!stable) throw badRequest("pool deliveries must be a configured stablecoin (STABLE_TOKEN_ADDRESSES)");
    chosen = stable;
    const decimals = await client.readContract({ address: stable.token as `0x${string}`, abi: erc20Abi, functionName: "decimals" });
    poolCreditMicro = toMicro(stable.value, Number(decimals));
  } else if (opts.bucket === "vault") {
    const ant = inbound.find((t) => t.token === env.ANT_ADDRESS);
    if (!ant) throw badRequest("vault deliveries must be ANT");
    chosen = ant;
  }
  const outbound = transfers.find((t) => managed.has(t.from) && t.token !== chosen.token);

  const [row] = await ctx.db
    .insert(tables.swaps)
    .values({
      bucket: opts.bucket, txHash: opts.txHash.toLowerCase(), fromToken: outbound?.token ?? null, fromAmount: outbound?.value ?? null,
      toToken: chosen.token, toAmount: chosen.value, toAddress: dest, poolCreditMicro, recordedBy: opts.actor, verified: true,
      verifiedAt: new Date(), note: opts.note,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) throw badRequest("transaction already recorded");
  return row;
}
