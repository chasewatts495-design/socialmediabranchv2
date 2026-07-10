import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { runDueWork } from "@/lib/scheduler/runner";

let db: Db;
const uuid = () => crypto.randomUUID();

beforeAll(async () => {
  const pglite = new PGlite(); // in-memory
  const d = drizzle(pglite, { schema });
  await migrate(d, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  db = d as unknown as Db;
});

describe("scheduler runner", () => {
  it("no due jobs → clean no-op", async () => {
    const res = await runDueWork(db);
    expect(res.claimed).toBe(0);
  });

  it("claims and completes a due job; leaves future jobs pending", async () => {
    const dueId = uuid();
    const futureId = uuid();
    await db.insert(schema.scheduleJobs).values([
      {
        id: dueId,
        kind: "publish_post",
        refId: "nonexistent-post", // publishPostNow no-ops on missing post
        runAt: new Date(Date.now() - 1000),
      },
      {
        id: futureId,
        kind: "publish_post",
        refId: "later",
        runAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    const res = await runDueWork(db);
    expect(res.claimed).toBe(1);
    expect(res.done).toBe(1);

    const [due] = await db
      .select()
      .from(schema.scheduleJobs)
      .where(eq(schema.scheduleJobs.id, dueId));
    expect(due.status).toBe("done");

    const [future] = await db
      .select()
      .from(schema.scheduleJobs)
      .where(eq(schema.scheduleJobs.id, futureId));
    expect(future.status).toBe("pending");
  });

  it("is idempotent — a second tick reclaims nothing", async () => {
    const res = await runDueWork(db);
    expect(res.claimed).toBe(0);
  });

  it("failing jobs back off and eventually fail permanently", async () => {
    const id = uuid();
    await db.insert(schema.scheduleJobs).values({
      id,
      kind: "does_not_exist",
      refId: "x",
      runAt: new Date(Date.now() - 1000),
      maxAttempts: 3,
    });

    // attempt 1 → retried with backoff
    let res = await runDueWork(db);
    expect(res.retried).toBe(1);
    let [job] = await db
      .select()
      .from(schema.scheduleJobs)
      .where(eq(schema.scheduleJobs.id, id));
    expect(job.status).toBe("pending");
    expect(job.attemptCount).toBe(1);
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());

    // pull runAt back and go again (attempts 2 and 3)
    for (const expectFinal of [false, true]) {
      await db
        .update(schema.scheduleJobs)
        .set({ runAt: new Date(Date.now() - 1000) })
        .where(eq(schema.scheduleJobs.id, id));
      res = await runDueWork(db);
      [job] = await db
        .select()
        .from(schema.scheduleJobs)
        .where(eq(schema.scheduleJobs.id, id));
      if (expectFinal) {
        expect(res.failed).toBe(1);
        expect(job.status).toBe("failed");
        expect(job.lastError).toContain("Unknown job kind");
      } else {
        expect(job.status).toBe("pending");
      }
    }
  });

  it("publishes a real scheduled post end-to-end through the demo connector", async () => {
    // Minimal world: platform, account, post, target, due job.
    await db.insert(schema.platforms).values({
      id: "instagram",
      displayName: "Instagram",
    }).onConflictDoNothing();
    const accountId = uuid();
    await db.insert(schema.accounts).values({
      id: accountId,
      platformId: "instagram",
      handle: "@test.brand",
      displayName: "Test Brand",
      mode: "demo",
    });
    const postId = uuid();
    await db.insert(schema.posts).values({
      id: postId,
      caption: "Scheduled hello",
      status: "scheduled",
      scheduledAt: new Date(Date.now() - 1000),
    });
    // Media asset so Instagram's requiresMedia passes.
    const assetId = uuid();
    await db.insert(schema.mediaAssets).values({
      id: assetId,
      filename: "a.png",
      url: "data:image/png;base64,x",
      mimeType: "image/png",
      sizeBytes: 1000,
    });
    await db.insert(schema.postMedia).values({
      postId,
      mediaAssetId: assetId,
    });
    await db.insert(schema.postTargets).values({
      id: uuid(),
      postId,
      accountId,
      variantCaption: "Scheduled hello",
      status: "queued",
    });
    await db.insert(schema.scheduleJobs).values({
      id: uuid(),
      kind: "publish_post",
      refId: postId,
      runAt: new Date(Date.now() - 500),
    });

    const res = await runDueWork(db);
    expect(res.done).toBeGreaterThanOrEqual(1);

    const [post] = await db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, postId));
    expect(post.status).toBe("published");

    const targets = await db
      .select()
      .from(schema.postTargets)
      .where(eq(schema.postTargets.postId, postId));
    expect(targets[0].status).toBe("published");
    expect(targets[0].externalUrl).toBeTruthy();
  }, 20_000);
});
