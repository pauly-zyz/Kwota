import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function runMigrations(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");
  await migrate(drizzle(client), { migrationsFolder: dir });
  await client.end();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  runMigrations(url).then(() => console.log("migrations applied"));
}
