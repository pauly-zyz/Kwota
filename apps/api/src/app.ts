import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import type { Ctx } from "./context";
import { HttpError } from "./lib/errors";
import { gatewayRoutes } from "./gateway/routes";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { agentRoutes } from "./routes/agents";
import { publicRoutes } from "./routes/public";
import { adminRoutes } from "./routes/admin";

export async function buildApp(ctx: Ctx, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 1_000_000, trustProxy: true });

  // keep the raw body: EIP-712 agent signatures cover keccak256(raw body)
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as FastifyRequest & { rawBody?: string }).rawBody = body as string;
    if (!body) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch {
      const err = new HttpError(400, "invalid_json", "invalid JSON body");
      done(err as Error, undefined);
    }
  });

  const origins = ctx.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      // /v1 gateway is called server-to-server with API keys; browser access only from allowed origins
      cb(null, origins.includes("*") || origins.includes(origin));
    },
    allowedHeaders: ["authorization", "content-type", "x-kwota-agent", "x-kwota-registry", "x-kwota-nonce", "x-kwota-expiry", "x-kwota-signature"],
    exposedHeaders: ["x-kwota-cost-micro", "x-kwota-balance-micro", "x-kwota-request-id"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) return reply.status(400).send({ error: { code: "invalid_request", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") } });
    const e = err as { statusCode?: number; message: string };
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: { code: "invalid_request", message: e.message } });
    req.log.error(err);
    return reply.status(500).send({ error: { code: "internal_error", message: ctx.env.NODE_ENV === "production" ? "internal error" : e.message } });
  });

  await publicRoutes(app, ctx);
  await authRoutes(app, ctx);
  await meRoutes(app, ctx);
  await agentRoutes(app, ctx);
  await adminRoutes(app, ctx);
  await gatewayRoutes(app, ctx);
  return app;
}
