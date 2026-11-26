import { afterAll, beforeAll, expect, it } from "vitest";
import { ADMIN_ACTION_TYPES, adminDomain } from "@kwota/core";
import { admin, holder, login, setup } from "./helpers";

let s: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  s = await setup({ ALLOW_ADMIN_ADJUST: "true" });
});
afterAll(async () => {
  await s.app.close();
  await s.ctx.close();
});

it("admin can credit a tester (signed, audited, in ledger)", async () => {
  const token = await login(s.app, admin);
  const payload = JSON.stringify({ address: holder.address, amount: "5.5", note: "testnet tester" });
  const issuedAt = Math.floor(Date.now() / 1000);
  const signature = await admin.signTypedData({ domain: adminDomain(46630), types: ADMIN_ACTION_TYPES, primaryType: "AdminAction", message: { action: "adjust_balance", payload, nonce: "adj-1", issuedAt: BigInt(issuedAt) } });
  const res = await s.app.inject({ method: "POST", url: "/admin/adjust", headers: { authorization: `Bearer ${token}` }, payload: { action: "adjust_balance", payload, nonce: "adj-1", issuedAt, signature } });
  expect(res.statusCode).toBe(200);
  const u = await s.ctx.ledger.ensureUser(holder.address);
  const acc = await s.ctx.ledger.holderAccount(u.id);
  expect(acc.balanceMicro).toBe(5_500_000n);
  expect(await s.ctx.ledger.reconcile()).toEqual([]);
});
