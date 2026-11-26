import { verifyTypedData } from "viem";
import { ADMIN_ACTION_TYPES, adminDomain } from "@kwota/core";
import { tables } from "@kwota/db";
import type { FastifyRequest } from "fastify";
import type { Ctx } from "../context";
import { sessionAddress } from "../gateway/principal";
import { forbidden, unauthorized } from "../lib/errors";

export interface SignedAdminAction {
  action: string;
  payload: string; // JSON string
  nonce: string;
  issuedAt: number;
  signature: `0x${string}`;
}

export async function requireAdminSession(ctx: Ctx, req: FastifyRequest): Promise<string> {
  const addr = await sessionAddress(ctx, req);
  if (!addr) throw unauthorized();
  if (!ctx.env.ADMIN_ADDRESSES.includes(addr)) throw forbidden("not an admin");
  return addr;
}

/**
 * Every admin mutation must carry an EIP-712 signature from an admin wallet over
 * (action, payload, nonce, issuedAt). The signature is stored in the audit log.
 */
export async function verifyAdminAction(ctx: Ctx, admin: string, expectedAction: string, body: unknown): Promise<{ payload: unknown; signature: string }> {
  const b = body as Partial<SignedAdminAction>;
  if (!b || typeof b.payload !== "string" || typeof b.nonce !== "string" || typeof b.signature !== "string" || typeof b.issuedAt !== "number") {
    throw unauthorized("signed admin action required");
  }
  if (b.action !== expectedAction) throw unauthorized("action mismatch");
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - b.issuedAt) > 600) throw unauthorized("admin signature expired");
  const ok = await verifyTypedData({
    address: admin as `0x${string}`,
    domain: adminDomain(ctx.env.CHAIN_ID),
    types: ADMIN_ACTION_TYPES,
    primaryType: "AdminAction",
    message: { action: b.action, payload: b.payload, nonce: b.nonce, issuedAt: BigInt(b.issuedAt) },
    signature: b.signature as `0x${string}`,
  }).catch(() => false);
  if (!ok) throw unauthorized("bad admin signature");
  if (!(await ctx.kv.setNx(`admin:nonce:${b.nonce}`, "1", 1200))) throw unauthorized("admin nonce reused");
  return { payload: JSON.parse(b.payload), signature: b.signature };
}

export async function audit(ctx: Ctx, e: { actor: string; action: string; targetType?: string; targetId?: string; before?: unknown; after?: unknown; signature?: string; ip?: string }) {
  const j = (v: unknown) => (v === undefined ? null : JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x))));
  await ctx.db.insert(tables.auditLog).values({
    actor: e.actor, action: e.action, targetType: e.targetType, targetId: e.targetId, before: j(e.before), after: j(e.after), signature: e.signature, ip: e.ip,
  });
}
