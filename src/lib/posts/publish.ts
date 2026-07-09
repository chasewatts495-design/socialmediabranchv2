import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { activityLog, posts, postTargets } from "@/lib/db/schema";
import { resolveConnector } from "@/lib/connectors/registry";
import type {
  PlatformId,
  PublishMedia,
  PublishPayload,
} from "@/lib/connectors/types";
import { contextFor } from "@/lib/scheduler/jobs";
import { getSetting } from "@/lib/settings";

const uuid = () => crypto.randomUUID();

async function loadPost(db: Db, postId: string) {
  return db.query.posts.findFirst({
    where: (p, { eq: e }) => e(p.id, postId),
    with: {
      targets: { with: { account: true } },
      media: { with: { asset: true } },
    },
  });
}

function mediaPayload(
  media: NonNullable<Awaited<ReturnType<typeof loadPost>>>["media"],
): PublishMedia[] {
  return [...media]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      url: m.asset.url,
      mimeType: m.asset.mimeType,
      sizeBytes: m.asset.sizeBytes,
      width: m.asset.width,
      height: m.asset.height,
      durationSec: m.asset.durationSec,
    }));
}

async function publishSingleTarget(
  db: Db,
  target: {
    id: string;
    variantCaption: string;
    variantMeta: Record<string, unknown>;
    attemptCount: number;
    account: {
      id: string;
      platformId: string;
      handle: string;
      mode: string;
    };
  },
  fallbackCaption: string,
  media: PublishMedia[],
  simulateFailures: boolean,
): Promise<"published" | "failed" | "manual_required"> {
  const account = target.account;
  const connector = resolveConnector(
    {
      platformId: account.platformId as PlatformId,
      mode: account.mode as "demo" | "live" | "manual",
    },
    { demo: { simulateFailures } },
  );

  if (!connector.capabilities.canPublish) {
    await db
      .update(postTargets)
      .set({
        status: "manual_required",
        errorCode: null,
        errorMessage:
          "Post this manually in the app, then hit 'Mark published'.",
        lastAttemptAt: new Date(),
      })
      .where(eq(postTargets.id, target.id));
    await db.insert(activityLog).values({
      id: uuid(),
      event: "post.manual_required",
      accountId: account.id,
      postId: undefined,
      detail: { targetId: target.id },
    });
    return "manual_required";
  }

  await db
    .update(postTargets)
    .set({
      status: "publishing",
      attemptCount: target.attemptCount + 1,
      lastAttemptAt: new Date(),
    })
    .where(eq(postTargets.id, target.id));

  const payload: PublishPayload = {
    caption: target.variantCaption || fallbackCaption,
    media,
    meta: target.variantMeta ?? {},
  };

  const result = await connector.publishPost(contextFor(db, account), payload);

  if (result.ok) {
    await db
      .update(postTargets)
      .set({
        status: "published",
        externalPostId: result.externalPostId,
        externalUrl: result.url ?? null,
        errorCode: null,
        errorMessage: null,
        publishedAt: new Date(),
      })
      .where(eq(postTargets.id, target.id));
    await db.insert(activityLog).values({
      id: uuid(),
      event: "post.published",
      accountId: account.id,
      detail: { targetId: target.id, url: result.url },
    });
    return "published";
  }

  await db
    .update(postTargets)
    .set({
      status: "failed",
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    })
    .where(eq(postTargets.id, target.id));
  await db.insert(activityLog).values({
    id: uuid(),
    event: "post.failed",
    level: "error",
    accountId: account.id,
    detail: { targetId: target.id, code: result.errorCode, message: result.errorMessage },
  });
  return "failed";
}

async function refreshPostStatus(db: Db, postId: string): Promise<void> {
  const targets = await db
    .select({ status: postTargets.status, publishedAt: postTargets.publishedAt })
    .from(postTargets)
    .where(eq(postTargets.postId, postId));
  if (targets.length === 0) return;

  const done = targets.filter((t) =>
    ["published", "manual_required", "skipped"].includes(t.status),
  ).length;
  const failed = targets.filter((t) => t.status === "failed").length;
  const anyPublished = targets.some((t) => t.status === "published");

  let status: string;
  if (done === targets.length) status = "published";
  else if (failed > 0 && failed + done === targets.length)
    status = anyPublished || done > 0 ? "partially_failed" : "failed";
  else if (failed > 0) status = "partially_failed";
  else status = "publishing";

  await db
    .update(posts)
    .set({
      status,
      publishedAt: anyPublished ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));
}

/**
 * Publishes every queued/pending target of a post through its connector.
 * Already-published targets are skipped (idempotent — safe to re-run after
 * partial failures; only the failed targets are retried via retryTarget).
 */
export async function publishPostNow(db: Db, postId: string): Promise<void> {
  const post = await loadPost(db, postId);
  if (!post) return;

  await db
    .update(posts)
    .set({ status: "publishing", updatedAt: new Date() })
    .where(eq(posts.id, postId));

  const simulateFailures =
    (await getSetting("demo.simulateFailures")) === "true";
  const media = mediaPayload(post.media);

  const eligible = post.targets.filter((t) =>
    ["pending", "queued"].includes(t.status),
  );
  for (const target of eligible) {
    await publishSingleTarget(db, target, post.caption, media, simulateFailures);
  }
  await refreshPostStatus(db, postId);
}

/** Retries one failed/manual target. */
export async function retryTarget(db: Db, targetId: string): Promise<void> {
  const target = await db.query.postTargets.findFirst({
    where: (t, { eq: e }) => e(t.id, targetId),
    with: { account: true, post: { with: { media: { with: { asset: true } } } } },
  });
  if (!target || target.status === "published") return;

  const simulateFailures =
    (await getSetting("demo.simulateFailures")) === "true";
  await publishSingleTarget(
    db,
    target,
    target.post.caption,
    mediaPayload(target.post.media),
    simulateFailures,
  );
  await refreshPostStatus(db, target.postId);
}

/** Marks a manual_required target as done (posted by hand). */
export async function markManualPublished(
  db: Db,
  targetId: string,
  externalUrl?: string,
): Promise<void> {
  const target = await db.query.postTargets.findFirst({
    where: (t, { eq: e }) => e(t.id, targetId),
  });
  if (!target) return;
  await db
    .update(postTargets)
    .set({
      status: "published",
      externalUrl: externalUrl || target.externalUrl,
      errorMessage: null,
      publishedAt: new Date(),
    })
    .where(eq(postTargets.id, targetId));
  await refreshPostStatus(db, target.postId);
}

export async function skipTarget(db: Db, targetId: string): Promise<void> {
  const target = await db.query.postTargets.findFirst({
    where: (t, { eq: e }) => e(t.id, targetId),
  });
  if (!target || target.status === "published") return;
  await db
    .update(postTargets)
    .set({ status: "skipped" })
    .where(eq(postTargets.id, targetId));
  await refreshPostStatus(db, target.postId);
}

/** Cancels a scheduled post (post + its queued targets + pending job). */
export async function cancelScheduledPost(db: Db, postId: string): Promise<void> {
  const { scheduleJobs } = await import("@/lib/db/schema");
  await db
    .update(postTargets)
    .set({ status: "pending" })
    .where(
      inArray(
        postTargets.id,
        (
          await db
            .select({ id: postTargets.id })
            .from(postTargets)
            .where(eq(postTargets.postId, postId))
        ).map((r) => r.id),
      ),
    );
  await db
    .update(posts)
    .set({ status: "draft", scheduledAt: null, updatedAt: new Date() })
    .where(eq(posts.id, postId));
  const { and, eq: e } = await import("drizzle-orm");
  await db
    .update(scheduleJobs)
    .set({ status: "canceled" })
    .where(
      and(
        e(scheduleJobs.kind, "publish_post"),
        e(scheduleJobs.refId, postId),
        e(scheduleJobs.status, "pending"),
      ),
    );
}
