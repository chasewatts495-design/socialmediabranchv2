"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { postMedia, posts, postTargets, scheduleJobs } from "@/lib/db/schema";
import {
  cancelScheduledPost,
  markManualPublished,
  publishPostNow,
  retryTarget,
  skipTarget,
} from "@/lib/posts/publish";

const uuid = () => crypto.randomUUID();

const savePayloadSchema = z.object({
  postId: z.string().nullish(),
  caption: z.string().max(65_000),
  mediaIds: z.array(z.string()).max(10),
  targets: z
    .array(
      z.object({
        accountId: z.string(),
        caption: z.string().max(65_000),
        meta: z.record(z.string(), z.unknown()).default({}),
        /** Per-platform time override; null → the post's master time. */
        scheduledAt: z.iso.datetime().nullish(),
      }),
    )
    .max(30),
  mode: z.enum(["draft", "now", "schedule"]),
  scheduledAt: z.iso.datetime().nullish(),
});

export type SavePostPayload = z.infer<typeof savePayloadSchema>;

export interface SavePostResult {
  ok: boolean;
  postId?: string;
  message?: string;
  targets?: {
    accountId: string;
    status: string;
    errorMessage: string | null;
    externalUrl: string | null;
  }[];
}

export async function savePostAction(
  payload: SavePostPayload,
): Promise<SavePostResult> {
  const parsed = savePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: "Invalid post data." };
  }
  const data = parsed.data;
  if (data.mode !== "draft" && data.targets.length === 0) {
    return { ok: false, message: "Pick at least one account." };
  }
  if (data.mode === "schedule") {
    if (!data.scheduledAt) return { ok: false, message: "Pick a date & time." };
    if (new Date(data.scheduledAt) <= new Date()) {
      return { ok: false, message: "Scheduled time must be in the future." };
    }
    for (const t of data.targets) {
      if (t.scheduledAt && new Date(t.scheduledAt) <= new Date()) {
        return {
          ok: false,
          message: "Every per-platform time must be in the future.",
        };
      }
    }
  }

  const db = await getDb();
  const postId = data.postId ?? uuid();
  // The post's own time = the earliest moment anything goes out.
  const targetTimes =
    data.mode === "schedule"
      ? data.targets
          .map((t) => (t.scheduledAt ? new Date(t.scheduledAt) : null))
          .filter((d): d is Date => Boolean(d))
      : [];
  const masterTime =
    data.mode === "schedule" && data.scheduledAt
      ? new Date(data.scheduledAt)
      : null;
  const scheduledAt = masterTime
    ? new Date(
        Math.min(
          masterTime.getTime(),
          ...targetTimes.map((d) => d.getTime()),
        ),
      )
    : null;
  const status = data.mode === "schedule" ? "scheduled" : "draft";

  if (data.postId) {
    const existing = await db.query.posts.findFirst({
      where: (p, { eq: e }) => e(p.id, data.postId!),
    });
    if (!existing) return { ok: false, message: "Draft no longer exists." };
    await db
      .update(posts)
      .set({ caption: data.caption, status, scheduledAt, updatedAt: new Date() })
      .where(eq(posts.id, postId));
    await db.delete(postMedia).where(eq(postMedia.postId, postId));
    await db.delete(postTargets).where(eq(postTargets.postId, postId));
    // Editing supersedes any previously scheduled release — cancel the old
    // publish jobs or a post pulled back to draft still fires on time.
    await db
      .update(scheduleJobs)
      .set({ status: "canceled" })
      .where(
        and(
          eq(scheduleJobs.kind, "publish_post"),
          eq(scheduleJobs.refId, postId),
          eq(scheduleJobs.status, "pending"),
        ),
      );
  } else {
    await db.insert(posts).values({
      id: postId,
      caption: data.caption,
      status,
      scheduledAt,
    });
  }

  if (data.mediaIds.length) {
    await db.insert(postMedia).values(
      data.mediaIds.map((mediaAssetId, i) => ({
        postId,
        mediaAssetId,
        sortOrder: i,
      })),
    );
  }
  if (data.targets.length) {
    await db.insert(postTargets).values(
      data.targets.map((t) => ({
        id: uuid(),
        postId,
        accountId: t.accountId,
        variantCaption: t.caption,
        variantMeta: t.meta as Record<string, unknown>,
        // Every scheduled target carries its own effective time so the
        // publish pass can release each platform exactly on cue.
        scheduledAt:
          data.mode === "schedule"
            ? t.scheduledAt
              ? new Date(t.scheduledAt)
              : masterTime
            : null,
        status: data.mode === "draft" ? "pending" : "queued",
      })),
    );
  }

  if (data.mode === "now") {
    await publishPostNow(db, postId);
  } else if (data.mode === "schedule" && masterTime) {
    // One job per distinct release time — each pass publishes only the
    // targets that are due.
    const times = new Set<number>(
      data.targets.map((t) =>
        (t.scheduledAt ? new Date(t.scheduledAt) : masterTime).getTime(),
      ),
    );
    await db.insert(scheduleJobs).values(
      [...times].map((ms) => ({
        id: uuid(),
        kind: "publish_post",
        refId: postId,
        runAt: new Date(ms),
      })),
    );
  }

  revalidatePath("/calendar");
  revalidatePath("/library");
  revalidatePath("/");

  const resultTargets = await db.query.postTargets.findMany({
    where: (t, { eq: e }) => e(t.postId, postId),
  });
  return {
    ok: true,
    postId,
    targets: resultTargets.map((t) => ({
      accountId: t.accountId,
      status: t.status,
      errorMessage: t.errorMessage,
      externalUrl: t.externalUrl,
    })),
  };
}

export async function retryTargetAction(targetId: string): Promise<void> {
  const db = await getDb();
  await retryTarget(db, targetId);
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function skipTargetAction(targetId: string): Promise<void> {
  const db = await getDb();
  await skipTarget(db, targetId);
  revalidatePath("/calendar");
}

export async function markManualPublishedAction(
  targetId: string,
  externalUrl?: string,
): Promise<void> {
  const db = await getDb();
  await markManualPublished(db, targetId, externalUrl);
  revalidatePath("/calendar");
  revalidatePath("/");
}

export async function cancelScheduledAction(postId: string): Promise<void> {
  const db = await getDb();
  await cancelScheduledPost(db, postId);
  revalidatePath("/calendar");
}

export async function deleteDraftAction(postId: string): Promise<void> {
  const db = await getDb();
  const post = await db.query.posts.findFirst({
    where: (p, { eq: e }) => e(p.id, postId),
  });
  if (post && post.status === "draft") {
    await db.delete(posts).where(eq(posts.id, postId));
  }
  revalidatePath("/library");
  revalidatePath("/calendar");
}
