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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { reschedulePostAction, savePostAction } from "@/server/actions/posts";

const uuid = () => crypto.randomUUID();
let db: Db;
let accountId: string;

beforeAll(async () => {
  const pglite = new PGlite();
  const d = drizzle(pglite, { schema });
  await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
  holder.db = db;
  await db
    .insert(schema.platforms)
    .values({ id: "facebook", displayName: "Facebook", sortOrder: 0 });
  accountId = uuid();
  await db.insert(schema.accounts).values({
    id: accountId,
    platformId: "facebook",
    handle: "@drag",
    displayName: "Drag",
    mode: "demo",
  });
});

describe("drag-to-reschedule", () => {
  it("moves the day, keeps the time, and replaces the publish job", async () => {
    const at = new Date(Date.now() + 24 * 3_600_000);
    const saved = await savePostAction({
      postId: null,
      caption: "movable",
      mediaIds: [],
      targets: [{ accountId, caption: "v", meta: {}, scheduledAt: null }],
      mode: "schedule",
      scheduledAt: at.toISOString(),
    });
    const postId = saved.postId!;

    const target = new Date(Date.now() + 5 * 86_400_000);
    const targetISO = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
    const res = await reschedulePostAction(postId, targetISO);
    expect(res.ok).toBe(true);

    const post = await db.query.posts.findFirst({
      where: (p, { eq: e }) => e(p.id, postId),
    });
    // Same wall-clock time, new day.
    expect(post!.scheduledAt!.getHours()).toBe(at.getHours());
    expect(post!.scheduledAt!.getDate()).toBe(target.getDate());

    const pending = await db
      .select()
      .from(schema.scheduleJobs)
      .where(
        and(
          eq(schema.scheduleJobs.refId, postId),
          eq(schema.scheduleJobs.status, "pending"),
        ),
      );
    expect(pending).toHaveLength(1);
    expect(pending[0].runAt.getDate()).toBe(target.getDate());
  });

  it("refuses non-scheduled posts and past days", async () => {
    const draftId = uuid();
    await db.insert(schema.posts).values({ id: draftId, caption: "draft" });
    expect((await reschedulePostAction(draftId, "2030-01-01")).ok).toBe(false);
    expect((await reschedulePostAction(draftId, "not-a-date")).ok).toBe(false);
  });
});
