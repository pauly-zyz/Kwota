import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Ctx } from "../context";
import { issueNonce, verifySiwe } from "../auth/siwe";
import { signSession } from "../auth/session";

export async function authRoutes(app: FastifyInstance, ctx: Ctx) {
  const domains = ctx.env.CORS_ORIGINS.split(",").map((o) => o.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")).filter(Boolean);

  app.get("/auth/nonce", async () => ({ nonce: await issueNonce(ctx.kv) }));

  app.post("/auth/verify", async (req) => {
    const body = z.object({ message: z.string().max(4000), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) }).parse(req.body);
    const address = await verifySiwe({ kv: ctx.kv, message: body.message, signature: body.signature as `0x${string}`, domain: domains, chainId: ctx.env.CHAIN_ID, client: ctx.client });
    await ctx.ledger.ensureUser(address);
    return { token: signSession(ctx.env.SESSION_SECRET, address), address, isAdmin: ctx.env.ADMIN_ADDRESSES.includes(address) };
  });
}
