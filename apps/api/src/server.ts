import { loadEnv } from "./env";
import { createContext } from "./context";
import { buildApp } from "./app";
import { runMigrations } from "@kwota/db/migrate";
import { seedDefaults } from "./seedLib";
import { EpochEngine } from "./epoch/engine";
import { Indexer } from "./indexer/indexer";
import { releaseStaleReservations } from "./gateway/routes";

const env = loadEnv();
if (process.env.AUTO_MIGRATE !== "false") await runMigrations(env.DATABASE_URL);
const ctx = createContext(env);
if (env.AUTO_SEED) {
  try {
    const r = await seedDefaults(ctx);
    console.log(`[seed] ${r.models} models`);
  } catch (e) {
    console.error("[seed] failed:", (e as Error).message);
  }
}
const app = await buildApp(ctx, { logger: true });
await app.listen({ port: env.PORT, host: env.HOST });

let stopping = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Single-service hosting: run the indexer and epoch worker in this process.
if (env.RUN_INDEXER && ctx.client && (env.KWOTA_TOKEN_ADDRESS || env.TREASURY_ADDRESS)) {
  const indexer = new Indexer(ctx, ctx.client);
  void (async () => {
    while (!stopping) {
      try {
        const r = await indexer.tick();
        if (!r) await sleep(env.INDEXER_POLL_MS);
      } catch (e) {
        app.log.error({ err: (e as Error).message }, "indexer");
        await sleep(env.INDEXER_POLL_MS * 2);
      }
    }
  })();
}
if (env.RUN_WORKER) {
  const engine = new EpochEngine(ctx);
  void (async () => {
    while (!stopping) {
      try {
        await engine.tick();
        await releaseStaleReservations(ctx);
        const mm = await ctx.ledger.reconcile();
        if (mm.length) app.log.error({ mismatches: mm }, "LEDGER MISMATCH");
      } catch (e) {
        app.log.warn({ err: (e as Error).message }, "worker");
      }
      await sleep(60_000);
    }
  })();
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    stopping = true;
    await app.close();
    await ctx.close();
    process.exit(0);
  });
}
