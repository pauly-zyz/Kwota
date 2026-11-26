import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Ctx } from "../context";
import { kwotaAmount, requireUser } from "./me";
import { toJson } from "../lib/json";

export async function agentRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/agents/registries", async () => toJson(await ctx.agents.listRegistries()));

  app.get("/me/agents", async (req) => {
    const user = await requireUser(ctx, req);
    return toJson(await ctx.agents.listForUser(user.id));
  });

  app.post("/me/agents", async (req) => {
    const user = await requireUser(ctx, req);
    const b = z.object({ registryId: z.number().int(), agentTokenId: z.string().regex(/^\d{1,78}$/), name: z.string().max(64).optional(), dailyLimit: kwotaAmount }).parse(req.body);
    const agent = await ctx.agents.register({ userId: user.id, userAddress: user.address, registryId: b.registryId, agentTokenId: BigInt(b.agentTokenId), name: b.name, dailyLimitMicro: b.dailyLimit });
    return toJson(agent);
  });

  const idParam = z.object({ id: z.coerce.number().int() });

  app.post("/me/agents/:id/allocate", async (req) => {
    const user = await requireUser(ctx, req);
    const { id } = idParam.parse(req.params);
    const { amount } = z.object({ amount: kwotaAmount }).parse(req.body);
    return toJson(await ctx.agents.allocate(user.id, id, amount, `wallet:${user.address}`));
  });

  app.post("/me/agents/:id/reclaim", async (req) => {
    const user = await requireUser(ctx, req);
    const { id } = idParam.parse(req.params);
    const { amount } = z.object({ amount: kwotaAmount.optional() }).parse(req.body ?? {});
    return toJson((await ctx.agents.reclaim(user.id, id, `wallet:${user.address}`, amount)) ?? { reclaimed: "0" });
  });

  app.post("/me/agents/:id/stop", async (req) => {
    const user = await requireUser(ctx, req);
    const { id } = idParam.parse(req.params);
    const { reclaim } = z.object({ reclaim: z.boolean().default(true) }).parse(req.body ?? {});
    const agent = await ctx.agents.setStatus(user.id, id, "stopped");
    const reclaimed = reclaim ? await ctx.agents.reclaim(user.id, id, `wallet:${user.address}`) : null;
    return toJson({ agent, reclaimed });
  });

  app.post("/me/agents/:id/resume", async (req) => {
    const user = await requireUser(ctx, req);
    const { id } = idParam.parse(req.params);
    return toJson(await ctx.agents.setStatus(user.id, id, "active"));
  });

  app.patch("/me/agents/:id", async (req) => {
    const user = await requireUser(ctx, req);
    const { id } = idParam.parse(req.params);
    const { dailyLimit } = z.object({ dailyLimit: kwotaAmount }).parse(req.body);
    return toJson(await ctx.agents.setDailyLimit(user.id, id, dailyLimit));
  });

  app.post("/me/agents/:id/refresh", async (req) => {
    const user = await requireUser(ctx, req);
    const { id } = idParam.parse(req.params);
    const a = await ctx.agents.get(id);
    if (!a || a.allocatorUserId !== user.id) return { error: "not found" };
    return toJson(await ctx.agents.refreshOwnership(id));
  });
}
