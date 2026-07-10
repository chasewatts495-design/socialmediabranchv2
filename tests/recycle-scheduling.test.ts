import { beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

const holder: { db?: Db } = {};
vi.mock("@/lib/db/client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...mod, getDb: async () => holder.db! };
});

import { runRecyclePick, recyclePoolPreview } from "@/lib/recycle";
import { publishPostNow } from "@/lib/posts/publish";
import { runDueWork } from "@/lib/scheduler/runner";

const uuid = () => crypto.randomUUID();
let db: Db;
let accountId: string;

function daysAgoDate(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function seedPublishedPost(caption: string, publishedDaysAgo: number) {
  const postId = uuid();
  const publishedAt = daysAgoDate(publishedDaysAgo);
  await db.insert(schema.posts).values({
    id: postId,
    caption,
    status: "published",
    publishedAt,
  });
  await db.insert(schema.postTargets).values({
    id: uuid(),
    postId,
    accountId,
    variantCaption: caption,
    status: "published",
    publishedAt,
    metrics: { engagementRate: 5 },
  });
  return postId;
}

beforeAll(async () => {
  const pglite = new PGlite();
  const d = drizzle(pglite, { schema });
  await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
  holder.db = db;

  await db
    .insert(schema.platforms)
    .values([{ id: "facebook", displayName: "Facebook", sortOrder: 0 }]);
  await db.insert(schema.brands).values({ id: "b1", name: "Brand" });
  accountId = uuid();
  await db.insert(schema.accounts).values({
    id: accountId,
    platformId: "facebook",
    brandId: "b1",
    handle: "@recycler",
    displayName: "Recycler",
    mode: "demo",
  });
});

describe("content recycling", () => {
  it("is a no-op without an enabled rule", async () => {
    const res = await runRecyclePick(db, accountId);
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/off/i);
  });

  it("recycles an old post: clone + queued target + publish job", async () => {
    const oldPostId = await seedPublishedPost("evergreen banger", 45);
    await seedPublishedPost("too fresh to rerun", 3);

    await db.insert(schema.recycleRules).values({
      id: uuid(),
      accountId,
      enabled: true,
      everyHours: 24,
      noRepeatDays: 30,
      windowStartHour: 0,
      windowEndHour: 24,
      freshenCaption: false,
    });

    const pool = await recyclePoolPreview(db, accountId, 30);
    expect(pool.eligibleCount).toBe(1); // only the 45-day-old post

    const res = await runRecyclePick(db, accountId);
    expect(res.ok).toBe(true);
    expect(res.scheduledPostId).toBeTruthy();

    const clone = await db.query.posts.findFirst({
      where: (p, { eq: e }) => e(p.id, res.scheduledPostId!),
    });
    expect(clone?.recycledFromPostId).toBe(oldPostId);
    expect(clone?.status).toBe("scheduled");
    expect(clone?.caption).toBe("evergreen banger");
    // Random time is inside [now+30min, now+30min+24h].
    const ms = clone!.scheduledAt!.getTime() - Date.now();
    expect(ms).toBeGreaterThan(25 * 60_000);
    expect(ms).toBeLessThan(25 * 3_600_000);

    const [job] = await db
      .select()
      .from(schema.scheduleJobs)
      .where(
        and(
          eq(schema.scheduleJobs.kind, "publish_post"),
          eq(schema.scheduleJobs.refId, res.scheduledPostId!),
        ),
      );
    expect(job?.status).toBe("pending");
  });

  it("won't pick the same root again while its clone is still queued", async () => {
    const res = await runRecyclePick(db, accountId);
    expect(res.ok).toBe(true);
    expect(res.scheduledPostId).toBeUndefined();
    expect(res.message).toMatch(/nothing eligible/i);
  });

  it("recycle_pick jobs self-reschedule through the runner", async () => {
    // Free the pool with another old post, then run the job via the runner.
    await seedPublishedPost("second evergreen", 60);
    await db.insert(schema.scheduleJobs).values({
      id: uuid(),
      kind: "recycle_pick",
      refId: accountId,
      runAt: new Date(Date.now() - 1000),
    });

    const tick = await runDueWork(db);
    expect(tick.done).toBeGreaterThanOrEqual(1);

    const next = await db
      .select()
      .from(schema.scheduleJobs)
      .where(
        and(
          eq(schema.scheduleJobs.kind, "recycle_pick"),
          eq(schema.scheduleJobs.refId, accountId),
          eq(schema.scheduleJobs.status, "pending"),
        ),
      );
    expect(next).toHaveLength(1); // rescheduled on the 24h cadence
    expect(next[0].runAt.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
  });
});

describe("per-platform scheduling", () => {
  it("publishPostNow releases only due targets; later ones stay queued", async () => {
    const postId = uuid();
    await db.insert(schema.posts).values({
      id: postId,
      caption: "staggered release",
      status: "scheduled",
      scheduledAt: new Date(),
    });
    const dueTarget = uuid();
    const laterTarget = uuid();
    await db.insert(schema.postTargets).values([
      {
        id: dueTarget,
        postId,
        accountId,
        variantCaption: "goes now",
        status: "queued",
        scheduledAt: new Date(Date.now() - 60_000),
      },
      {
        id: laterTarget,
        postId,
        accountId: await (async () => {
          // second account so the unique (postId, accountId) index is happy
          const id = uuid();
          await db.insert(schema.accounts).values({
            id,
            platformId: "facebook",
            brandId: "b1",
            handle: "@later",
            displayName: "Later",
            mode: "demo",
          });
          return id;
        })(),
        variantCaption: "goes in 4 hours",
        status: "queued",
        scheduledAt: new Date(Date.now() + 4 * 3_600_000),
      },
    ]);

    await publishPostNow(db, postId);

    const [due] = await db
      .select()
      .from(schema.postTargets)
      .where(eq(schema.postTargets.id, dueTarget));
    const [later] = await db
      .select()
      .from(schema.postTargets)
      .where(eq(schema.postTargets.id, laterTarget));
    expect(due.status).toBe("published");
    expect(later.status).toBe("queued");

    // Post shows in-flight (partially released), not failed/published.
    const [post] = await db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, postId));
    expect(["publishing", "scheduled"]).toContain(post.status);

    // Second pass at the later time releases the rest.
    await db
      .update(schema.postTargets)
      .set({ scheduledAt: new Date(Date.now() - 1000) })
      .where(eq(schema.postTargets.id, laterTarget));
    await publishPostNow(db, postId);
    const [later2] = await db
      .select()
      .from(schema.postTargets)
      .where(eq(schema.postTargets.id, laterTarget));
    expect(later2.status).toBe("published");
    const [post2] = await db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, postId));
    expect(post2.status).toBe("published");
  });
});
