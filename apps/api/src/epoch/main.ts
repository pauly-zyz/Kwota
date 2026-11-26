import { loadEnv } from "../env";
import { createContext } from "../context";
import { EpochEngine } from "./engine";
import { releaseStaleReservations } from "../gateway/routes";

const env = loadEnv();
const ctx = createContext(env);
const engine = new EpochEngine(ctx);
let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));
console.log(`[worker] auto-publish=${env.AUTO_PUBLISH_EPOCHS}`);

while (!stopping) {
  try {
    const done = await engine.tick();
    if (done.length) console.log(`[worker] published epochs ${done.join(", ")}`);
    const released = await releaseStaleReservations(ctx);
    if (released) console.log(`[worker] released ${released} stale reservations`);
    const mismatches = await ctx.ledger.reconcile();
    if (mismatches.length) console.error("[worker] LEDGER MISMATCH", mismatches);
  } catch (e) {
    console.error("[worker]", (e as Error).message);
  }
  await new Promise((r) => setTimeout(r, 60_000));
}
await ctx.close();
