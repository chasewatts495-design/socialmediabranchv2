/**
 * Applies committed SQL migrations from ./drizzle to the database named by
 * DATABASE_URL. With no DATABASE_URL, migrates the embedded PGlite database
 * (which the app also does automatically on startup).
 *
 * Runs during the Vercel build (see vercel.json buildCommand).
 */
import path from "node:path";

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function main() {
  const url = process.env.DATABASE_URL;

  if (url && /neon\.tech|vercel-storage|azure\.neon/.test(url)) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(drizzle(neon(url)), { migrationsFolder });
    console.log("Migrated Neon database.");
    return;
  }

  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: 1 });
    await migrate(drizzle(pool), { migrationsFolder });
    await pool.end();
    console.log("Migrated Postgres database.");
    return;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { mkdirSync } = await import("node:fs");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const pglite = new PGlite(dataDir);
  await migrate(drizzle(pglite), { migrationsFolder });
  await pglite.close();
  console.log("Migrated embedded PGlite database.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
