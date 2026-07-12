import { beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

const holder: { db?: Db } = {};
vi.mock("@/lib/db/client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...mod, getDb: async () => holder.db! };
});
// `after` runs its callback immediately in tests so effects are observable.
vi.mock("next/server", () => ({
  after: vi.fn((cb: () => Promise<void>) => void cb()),
}));

import { after } from "next/server";
import { opportunisticTick } from "@/lib/scheduler/lazy-tick";
import { getSetting } from "@/lib/settings";

const afterSpy = vi.mocked(after);

let db: Db;

beforeAll(async () => {
  const pglite = new PGlite();
  const d = drizzle(pglite, { schema });
  await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
  holder.db = db;
});

describe("opportunistic scheduler tick", () => {
  it("runs due work when stale, then stays quiet while fresh", async () => {
    // A due job the tick should pick up (canceled recycle rule → the job
    // completes without touching any connector).
    const jobId = crypto.randomUUID();
    await db.insert(schema.scheduleJobs).values({
      id: jobId,
      kind: "trend_scan",
      refId: "all:", // empty keyword → handled as a no-op, marked done
      runAt: new Date(Date.now() - 60_000),
    });

    await opportunisticTick();
    expect(afterSpy).toHaveBeenCalledTimes(1);
    // Give the immediate callback a beat to finish its awaits.
    await new Promise((r) => setTimeout(r, 250));

    expect(await getSetting("cron.lastTickAt")).toBeTruthy();
    const job = await db.query.scheduleJobs.findFirst({
      where: (j, { eq }) => eq(j.id, jobId),
    });
    expect(job!.status).toBe("done");

    // Second call within the freshness window schedules nothing new.
    await opportunisticTick();
    expect(afterSpy).toHaveBeenCalledTimes(1);
  });
});
