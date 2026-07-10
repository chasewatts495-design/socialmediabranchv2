import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import path from "node:path";

/**
 * All three drivers (neon-http, node-postgres, pglite) expose the same
 * drizzle query surface for the operations this app uses (no interactive
 * transactions — neon-http doesn't support them). We normalize to one type.
 */
export type Db = NodePgDatabase<typeof schema>;

type DbGlobal = typeof globalThis & { __branchDb?: Promise<Db> };

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url && /neon\.tech|vercel-storage|azure\.neon/.test(url)) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema }) as unknown as Db;
  }

  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 5 });
    return drizzle(pool, { schema }) as unknown as Db;
  }

  // Zero-setup local development: embedded Postgres persisted to .data/pglite.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { mkdirSync } = await import("node:fs");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  const pglite = new PGlite(dataDir);
  const db = drizzle(pglite, { schema });
  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  const g = globalThis as DbGlobal;
  if (!g.__branchDb) {
    g.__branchDb = createDb().catch((err) => {
      // Don't cache a failed init — allow the next request to retry.
      g.__branchDb = undefined;
      throw err;
    });
  }
  return g.__branchDb;
}

export { schema };
