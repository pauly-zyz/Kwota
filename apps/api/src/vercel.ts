/**
 * Vercel Function entry: the whole Fastify API served from /api on the same
 * domain as the web app. Bundled to /api/index.js by `pnpm --filter @kwota/api bundle:vercel`.
 *
 * Needs on Vercel: a Postgres database connected to the project (Storage → Neon:
 * provides DATABASE_URL/POSTGRES_URL) and PROVIDER_API_KEY. Everything else has defaults.
 */
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { runMigrations } from "@kwota/db/migrate";
import { tables } from "@kwota/db";
import { loadEnv } from "./env";
import { createContext, ensureSessionSecret, type Ctx } from "./context";
import { buildApp } from "./app";
import { seedDefaults } from "./seedLib";
import { EpochEngine } from "./epoch/engine";
import { Indexer } from "./indexer/indexer";
import { releaseStaleReservations } from "./gateway/routes";

const DEFAULTS: Record<string, string> = {
  NODE_ENV: "production",
  KV_BACKEND: "postgres",
  DB_POOL_MAX: "1",
  AUTO_SESSION_SECRET: "true",
  AUTO_SEED: "true",
  MODEL_PROVIDER: process.env.PROVIDER_API_KEY ? "openai_compatible" : "mock",
  PROVIDER_ID: "surplus",
  PROVIDER_BASE_URL: "https://api.surplusintelligence.ai/v1",
  CHAIN_ID: "46630",
  ALLOW_ADMIN_ADJUST: "true",
};

let boot: Promise<{ app: FastifyInstance; ctx: Ctx }> | null = null;

async function init() {
  const src: Record<string, string | undefined> = { ...DEFAULTS, ...process.env };
  if (!src.CORS_ORIGINS) {
    // same-origin requests need no CORS, but SIWE binds the signed domain: allow this deployment's hosts
    const hosts = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL].filter(Boolean).map((h) => `https://${h}`);
    src.CORS_ORIGINS = [...hosts, "https://kwota*.vercel.app", "http://localhost:3000"].join(",");
  }
  const env = loadEnv(src);
  await runMigrations(env.DATABASE_URL, path.join(process.cwd(), "packages/db/migrations"));
  const ctx = createContext(env);
  await ensureSessionSecret(ctx);
  if (env.AUTO_SEED) {
    const [{ n }] = (await ctx.db.execute(sql`select count(*)::int as n from models`)) as unknown as [{ n: number }];
    if (n === 0) await seedDefaults(ctx).catch((e) => console.error("[seed]", (e as Error).message));
  }
  const app = await buildApp(ctx);

  // Vercel Cron (see vercel.json): epochs, stale reservations, one indexer step
  app.get("/cron", async (req, reply) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) return reply.status(401).send({ error: "unauthorized" });
    const out: Record<string, unknown> = {};
    out.epochs = await new EpochEngine(ctx).tick().catch((e) => `error: ${(e as Error).message}`);
    out.released = await releaseStaleReservations(ctx);
    if (ctx.client && (env.KWOTA_TOKEN_ADDRESS || env.TREASURY_ADDRESS)) {
      const idx = new Indexer(ctx, ctx.client);
      const steps: unknown[] = [];
      for (let i = 0; i < 20; i++) {
        const r = await idx.tick().catch((e) => ({ error: (e as Error).message }));
        if (!r) break;
        steps.push(r);
      }
      out.indexer = steps.length;
    }
    out.ledgerMismatches = (await ctx.ledger.reconcile()).length;
    void tables;
    return out;
  });

  await app.ready();
  return { app, ctx };
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // /api/<path> is rewritten to /api/index?__path=<path>; restore the API path
  const u = new URL(req.url ?? "/", "http://local");
  const p = u.searchParams.get("__path");
  u.searchParams.delete("__path");
  const apiPath = p !== null ? `/${p}` : u.pathname.replace(/^\/api(\/index)?/, "") || "/";
  req.url = apiPath + (u.search || "");

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    if (apiPath === "/health") return json(res, 200, { ok: false, ready: false, reason: "database_not_configured" });
    return json(res, 503, { error: { code: "not_configured", message: "KWOTA API: connect a Postgres database to this Vercel project" } });
  }
  try {
    boot ??= init();
    const { app } = await boot;
    app.routing(req, res);
  } catch (e) {
    boot = null;
    console.error("[kwota] boot failed", e);
    json(res, 503, { error: { code: "boot_failed", message: (e as Error).message } });
  }
}
