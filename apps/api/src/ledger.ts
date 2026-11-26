import { and, eq, sql } from "drizzle-orm";
import { tables, type Db, type Tx } from "@kwota/db";
import { paymentRequired } from "./lib/errors";

type LedgerKind = (typeof tables.ledgerKind.enumValues)[number];
type DbOrTx = Db | Tx;

export interface PostInput {
  accountId: number;
  deltaMicro: bigint;
  kind: LedgerKind;
  refType?: string;
  refId?: string;
  actor: string;
}

/**
 * The ONLY module that mutates kwota balances. Every balance change writes one
 * append-only ledger row carrying balance_after, inside the same transaction.
 */
export class Ledger {
  constructor(private db: Db) {}

  async ensureUser(address: string, tx: DbOrTx = this.db) {
    const a = address.toLowerCase();
    const [ins] = await tx.insert(tables.users).values({ address: a }).onConflictDoNothing().returning();
    if (ins) return ins;
    const [u] = await tx.select().from(tables.users).where(eq(tables.users.address, a));
    return u!;
  }

  async holderAccount(userId: number, tx: DbOrTx = this.db) {
    const [acc] = await tx
      .select()
      .from(tables.kwotaAccounts)
      .where(and(eq(tables.kwotaAccounts.userId, userId), eq(tables.kwotaAccounts.type, "holder")));
    if (acc) return acc;
    // advisory lock avoids duplicate holder accounts under concurrency
    return (tx as Db).transaction(async (t) => {
      await t.execute(sql`select pg_advisory_xact_lock(${userId})`);
      const [again] = await t
        .select()
        .from(tables.kwotaAccounts)
        .where(and(eq(tables.kwotaAccounts.userId, userId), eq(tables.kwotaAccounts.type, "holder")));
      if (again) return again;
      const [created] = await t.insert(tables.kwotaAccounts).values({ userId, type: "holder" }).returning();
      return created!;
    });
  }

  async agentAccount(userId: number, agentId: number, tx: DbOrTx = this.db) {
    const [acc] = await tx.select().from(tables.kwotaAccounts).where(eq(tables.kwotaAccounts.agentId, agentId));
    if (acc) return acc;
    const [created] = await tx
      .insert(tables.kwotaAccounts)
      .values({ userId, type: "agent", agentId })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [again] = await tx.select().from(tables.kwotaAccounts).where(eq(tables.kwotaAccounts.agentId, agentId));
    return again!;
  }

  /** Post a balance change inside an existing transaction. Fails if balance would drop below reserved. */
  async postIn(tx: Tx, p: PostInput) {
    const [row] = await tx
      .update(tables.kwotaAccounts)
      .set({ balanceMicro: sql`${tables.kwotaAccounts.balanceMicro} + ${p.deltaMicro}` })
      .where(
        and(
          eq(tables.kwotaAccounts.id, p.accountId),
          sql`${tables.kwotaAccounts.balanceMicro} + ${p.deltaMicro} >= ${tables.kwotaAccounts.reservedMicro}`,
        ),
      )
      .returning({ balance: tables.kwotaAccounts.balanceMicro });
    if (!row) throw paymentRequired();
    const [entry] = await tx
      .insert(tables.ledgerEntries)
      .values({
        accountId: p.accountId,
        deltaMicro: p.deltaMicro,
        kind: p.kind,
        refType: p.refType,
        refId: p.refId,
        balanceAfterMicro: row.balance,
        actor: p.actor,
      })
      .returning();
    return entry!;
  }

  async post(p: PostInput) {
    return this.db.transaction((tx) => this.postIn(tx, p));
  }

  /** Move kwota between two accounts atomically (allocation / reclaim). */
  async transfer(opts: {
    fromAccountId: number;
    toAccountId: number;
    amountMicro: bigint;
    kindOut: LedgerKind;
    kindIn: LedgerKind;
    refType: string;
    refId: string;
    actor: string;
  }) {
    if (opts.amountMicro <= 0n) throw new Error("amount must be positive");
    return this.db.transaction(async (tx) => {
      const out = await this.postIn(tx, {
        accountId: opts.fromAccountId, deltaMicro: -opts.amountMicro, kind: opts.kindOut,
        refType: opts.refType, refId: opts.refId, actor: opts.actor,
      });
      const inn = await this.postIn(tx, {
        accountId: opts.toAccountId, deltaMicro: opts.amountMicro, kind: opts.kindIn,
        refType: opts.refType, refId: opts.refId, actor: opts.actor,
      });
      return { out, in: inn };
    });
  }

  /** Atomically hold `amount` of available balance. Returns false if not enough. */
  async reserve(accountId: number, amountMicro: bigint, tx: DbOrTx = this.db): Promise<boolean> {
    const rows = await tx
      .update(tables.kwotaAccounts)
      .set({ reservedMicro: sql`${tables.kwotaAccounts.reservedMicro} + ${amountMicro}` })
      .where(
        and(
          eq(tables.kwotaAccounts.id, accountId),
          sql`${tables.kwotaAccounts.balanceMicro} - ${tables.kwotaAccounts.reservedMicro} >= ${amountMicro}`,
        ),
      )
      .returning({ id: tables.kwotaAccounts.id });
    return rows.length === 1;
  }

  async release(accountId: number, amountMicro: bigint, tx: DbOrTx = this.db) {
    await tx
      .update(tables.kwotaAccounts)
      .set({ reservedMicro: sql`greatest(${tables.kwotaAccounts.reservedMicro} - ${amountMicro}, 0)` })
      .where(eq(tables.kwotaAccounts.id, accountId));
  }

  /**
   * Convert a reservation into a final debit. If the real cost exceeds the
   * reservation, the extra is charged only up to the free balance (never negative).
   * Returns the amount actually charged.
   */
  async settleIn(tx: Tx, opts: { accountId: number; reservedMicro: bigint; costMicro: bigint; usageId: bigint; actor: string }) {
    await this.release(opts.accountId, opts.reservedMicro, tx);
    const [acc] = await tx
      .select()
      .from(tables.kwotaAccounts)
      .where(eq(tables.kwotaAccounts.id, opts.accountId))
      .for("update");
    const free = acc!.balanceMicro - acc!.reservedMicro;
    const charge = opts.costMicro < free ? opts.costMicro : free > 0n ? free : 0n;
    if (charge > 0n) {
      await this.postIn(tx, {
        accountId: opts.accountId, deltaMicro: -charge, kind: "usage_debit",
        refType: "usage", refId: opts.usageId.toString(), actor: opts.actor,
      });
    }
    return charge;
  }

  async balance(accountId: number) {
    const [acc] = await this.db.select().from(tables.kwotaAccounts).where(eq(tables.kwotaAccounts.id, accountId));
    return acc ?? null;
  }

  /** Reconciliation: cached balances must equal Σ ledger deltas. Returns mismatching account ids. */
  async reconcile(): Promise<{ accountId: number; cached: string; ledger: string }[]> {
    const rows = await this.db.execute(sql`
      select a.id as account_id, a.balance_micro::text as cached, coalesce(sum(l.delta_micro), 0)::text as ledger
      from kwota_accounts a left join ledger_entries l on l.account_id = a.id
      group by a.id having a.balance_micro <> coalesce(sum(l.delta_micro), 0)`);
    return (rows as unknown as { account_id: number; cached: string; ledger: string }[]).map((r) => ({
      accountId: r.account_id, cached: r.cached, ledger: r.ledger,
    }));
  }
}
