import { loadEnv } from "../env";
import { createContext } from "../context";
import { Indexer } from "./indexer";

const env = loadEnv();
const ctx = createContext(env);
if (!ctx.client) throw new Error("RPC_URL is required for the indexer");
const indexer = new Indexer(ctx, ctx.client);
console.log(`[indexer] chain ${env.CHAIN_ID} token=${env.KWOTA_TOKEN_ADDRESS ?? "-"} treasury=${env.TREASURY_ADDRESS ?? "-"}`);

let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));

while (!stopping) {
  try {
    const r = await indexer.tick();
    if (r) console.log(`[indexer] blocks ${r.from}-${r.to}: ${r.transfers} transfers, ${r.inflows} inflows`);
    else await new Promise((res) => setTimeout(res, env.INDEXER_POLL_MS));
  } catch (e) {
    console.error("[indexer] error", e);
    await new Promise((res) => setTimeout(res, env.INDEXER_POLL_MS * 2));
  }
}
await ctx.close();
