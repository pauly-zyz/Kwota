/** Seed models (from the active provider) and agent registries. Idempotent. */
import { loadEnv } from "./env";
import { createContext } from "./context";
import { runMigrations } from "@kwota/db/migrate";
import { seedDefaults } from "./seedLib";

const env = loadEnv();
await runMigrations(env.DATABASE_URL);
const ctx = createContext(env);
const r = await seedDefaults(ctx);
console.log(`seeded ${r.models} models`);
await ctx.close();
