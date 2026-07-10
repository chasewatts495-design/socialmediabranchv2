import { eq } from "drizzle-orm";
import { getDb, type Db } from "./client";
import { settings } from "./schema";
import { clearDemoData, runSeed, SEED_VERSION } from "./seed";

const LOCK_KEY = "seed.lock";
const VERSION_KEY = "seed.version";

async function readSetting(key: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

/** Re-seed, first clearing an older seed's demo rows so nothing duplicates. */
async function seedFresh(db: Db) {
  const existing = await readSetting(VERSION_KEY);
  if (existing === SEED_VERSION) return;
  // Sweep even when no version row exists — a seeder that crashed
  // mid-run leaves partial demo rows but no version, and re-seeding on
  // top of them would duplicate everything. clearDemoData only touches
  // seed-created rows, so this is safe on a genuinely fresh database too.
  await clearDemoData(db);
  await runSeed(db);
}

/**
 * Guarantees demo data exists before any page renders. Cheap when already
 * seeded (a single primary-key SELECT). Race-safe across concurrent cold
 * starts via an INSERT ... ON CONFLICT DO NOTHING lock row.
 */
export async function ensureSeeded(): Promise<void> {
  const db = await getDb();

  if ((await readSetting(VERSION_KEY)) === SEED_VERSION) return;

  const claimed = await db
    .insert(settings)
    .values({ key: LOCK_KEY, value: String(Date.now()) })
    .onConflictDoNothing()
    .returning({ key: settings.key });

  if (claimed.length > 0) {
    try {
      await seedFresh(db);
    } finally {
      await db.delete(settings).where(eq(settings.key, LOCK_KEY));
    }
    return;
  }

  // Another request is seeding — wait briefly for it to finish.
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if ((await readSetting(VERSION_KEY)) === SEED_VERSION) return;
  }
  // The other seeder likely crashed: clear the stale lock and retry once.
  await db.delete(settings).where(eq(settings.key, LOCK_KEY));
  const reclaim = await db
    .insert(settings)
    .values({ key: LOCK_KEY, value: String(Date.now()) })
    .onConflictDoNothing()
    .returning({ key: settings.key });
  if (reclaim.length > 0) {
    try {
      await seedFresh(db);
    } finally {
      await db.delete(settings).where(eq(settings.key, LOCK_KEY));
    }
  }
}
