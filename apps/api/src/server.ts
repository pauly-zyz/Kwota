import { loadEnv } from "./env";
import { createContext } from "./context";
import { buildApp } from "./app";
import { runMigrations } from "@kwota/db/migrate";

const env = loadEnv();
if (process.env.AUTO_MIGRATE !== "false") await runMigrations(env.DATABASE_URL);
const ctx = createContext(env);
const app = await buildApp(ctx, { logger: true });
await app.listen({ port: env.PORT, host: env.HOST });

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await app.close();
    await ctx.close();
    process.exit(0);
  });
}
