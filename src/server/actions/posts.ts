"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
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
  }

  const db = await getDb();
  const postId = data.postId ?? uuid();
  const scheduledAt =
    data.mode === "schedule" && data.scheduledAt
      ? new Date(data.scheduledAt)
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
        status: data.mode === "draft" ? "pending" : "queued",
      })),
    );
  }

  if (data.mode === "now") {
    await publishPostNow(db, postId);
  } else if (data.mode === "schedule" && scheduledAt) {
    await db.insert(scheduleJobs).values({
      id: uuid(),
      kind: "publish_post",
      refId: postId,
      runAt: scheduledAt,
    });
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
