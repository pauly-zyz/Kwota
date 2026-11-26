import { eq } from "drizzle-orm";
import { tables, type Db } from "@kwota/db";
import type { Env } from "../env";

export const ZERO = "0x0000000000000000000000000000000000000000";
export const DEAD = "0x000000000000000000000000000000000000dead";

/** Addresses never eligible for kwota: env-configured system wallets + DB exclusions/blacklist. */
export async function excludedSet(db: Db, env: Env): Promise<Set<string>> {
  const s = new Set<string>([ZERO, DEAD]);
  for (const a of [env.TREASURY_ADDRESS, env.POOL_WALLET_ADDRESS, env.VAULT_ADDRESS, env.OPS_WALLET_ADDRESS, env.KWOTA_TOKEN_ADDRESS]) if (a) s.add(a);
  for (const a of [...env.LP_PAIR_ADDRESSES, ...env.PROTOCOL_ADDRESSES]) s.add(a);
  const rows = await db.select().from(tables.excludedAddresses).where(eq(tables.excludedAddresses.active, true));
  for (const r of rows) s.add(r.address.toLowerCase());
  return s;
}

/** Wallets controlled by the project (fee flows between them are bookkeeping, not user activity). */
export function managedWallets(env: Env): Set<string> {
  const s = new Set<string>();
  for (const a of [env.TREASURY_ADDRESS, env.POOL_WALLET_ADDRESS, env.VAULT_ADDRESS, env.OPS_WALLET_ADDRESS]) if (a) s.add(a);
  for (const a of env.ADMIN_ADDRESSES) s.add(a);
  return s;
}
