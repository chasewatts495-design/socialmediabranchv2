import { beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

// Route every getDb() consumer (queries, settings, publish) at the in-memory
// test database instead of the on-disk dev database.
const holder: { db?: Db } = {};
vi.mock("@/lib/db/client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...mod, getDb: async () => holder.db! };
});

import { getDashboardData } from "@/lib/db/queries";
import { getComposerAccounts } from "@/lib/db/composer-queries";
import { getQueueRows } from "@/lib/db/calendar-queries";
import { publishPostNow } from "@/lib/posts/publish";
import { syncAccount } from "@/lib/scheduler/jobs";

const uuid = () => crypto.randomUUID();
let db: Db;

const BRAND_A = "brand-a";
const BRAND_B = "brand-b";
let igA: string; // facebook account in brand A (posting on; no media needed)
let ttA: string; // tiktok account in brand A (posting OFF)
let fbB: string; // instagram account in brand B (sync OFF)

beforeAll(async () => {
  const pglite = new PGlite(); // in-memory
  const d = drizzle(pglite, { schema });
  await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
  holder.db = db;

  await db.insert(schema.platforms).values([
    { id: "instagram", displayName: "Instagram", sortOrder: 0 },
    { id: "tiktok", displayName: "TikTok", sortOrder: 1 },
    { id: "facebook", displayName: "Facebook", sortOrder: 2 },
  ]);
  await db.insert(schema.brands).values([
    { id: BRAND_A, name: "Brand A", color: "#b08a2e" },
    { id: BRAND_B, name: "Brand B", color: "#22668a" },
  ]);

  igA = uuid();
  ttA = uuid();
  fbB = uuid();
  await db.insert(schema.accounts).values([
    {
      id: igA,
      platformId: "facebook",
      brandId: BRAND_A,
      handle: "@a.ig",
      displayName: "A on FB",
      mode: "demo",
      sortOrder: 0,
    },
    {
      id: ttA,
      platformId: "tiktok",
      brandId: BRAND_A,
      handle: "@a.tt",
      displayName: "A on TikTok",
      mode: "demo",
      postingEnabled: false,
      sortOrder: 1,
    },
    {
      id: fbB,
      platformId: "instagram",
      brandId: BRAND_B,
      handle: "B Page",
      displayName: "B on IG",
      mode: "demo",
      syncEnabled: false,
      sortOrder: 2,
    },
  ]);
});

describe("brand scoping", () => {
  it("dashboard only sees the active brand's accounts", async () => {
    const all = await getDashboardData(30);
    expect(all.accounts.map((a) => a.handle).sort()).toEqual(
      ["@a.ig", "@a.tt", "B Page"].sort(),
    );

    const scoped = await getDashboardData(30, BRAND_A);
    expect(scoped.accounts.map((a) => a.handle).sort()).toEqual([
      "@a.ig",
      "@a.tt",
    ]);
  });

  it("composer account picker is brand-scoped and carries postingEnabled", async () => {
    const scoped = await getComposerAccounts(BRAND_B);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].handle).toBe("B Page");

    const a = await getComposerAccounts(BRAND_A);
    const tiktok = a.find((x) => x.platformId === "tiktok");
    expect(tiktok?.postingEnabled).toBe(false);
  });

  it("queue rows are brand-scoped", async () => {
    const postId = uuid();
    await db.insert(schema.posts).values({ id: postId, caption: "queued" });
    await db.insert(schema.postTargets).values([
      { id: uuid(), postId, accountId: igA, status: "queued" },
      { id: uuid(), postId, accountId: fbB, status: "queued" },
    ]);
    expect((await getQueueRows()).length).toBe(2);
    expect((await getQueueRows(BRAND_A)).length).toBe(1);
    await db.delete(schema.posts).where(eq(schema.posts.id, postId));
  });
});

describe("per-account permissions", () => {
  it("publish skips posting-disabled accounts and publishes the rest", async () => {
    const postId = uuid();
    await db.insert(schema.posts).values({
      id: postId,
      caption: "permission test",
      status: "draft",
    });
    const okTarget = uuid();
    const blockedTarget = uuid();
    await db.insert(schema.postTargets).values([
      {
        id: okTarget,
        postId,
        accountId: igA,
        variantCaption: "hello instagram",
        status: "pending",
      },
      {
        id: blockedTarget,
        postId,
        accountId: ttA,
        variantCaption: "hello tiktok",
        status: "pending",
      },
    ]);

    await publishPostNow(db, postId);

    const [ok] = await db
      .select()
      .from(schema.postTargets)
      .where(eq(schema.postTargets.id, okTarget));
    const [blocked] = await db
      .select()
      .from(schema.postTargets)
      .where(eq(schema.postTargets.id, blockedTarget));

    expect(ok.status).toBe("published");
    expect(blocked.status).toBe("skipped");
    expect(blocked.errorCode).toBe("POSTING_DISABLED");

    // Skipped counts as handled → the post itself completes.
    const [post] = await db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, postId));
    expect(post.status).toBe("published");
  });

  it("sync is a no-op for sync-disabled accounts", async () => {
    const res = await syncAccount(db, fbB, { sinceDays: 7 });
    expect(res.ok).toBe(true);
    expect(res.upserted).toBe(0);
    expect(res.message).toMatch(/turned off/i);

    const rows = await db
      .select()
      .from(schema.metricSnapshots)
      .where(eq(schema.metricSnapshots.accountId, fbB));
    expect(rows).toHaveLength(0);
  });
});
