import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "./client";
import { postTargets } from "./schema";
import type {
  ComposerAccount,
  ComposerInitial,
} from "@/components/composer/ComposerClient";
import type { PlatformId } from "@/lib/connectors/types";

export async function getComposerAccounts(
  brandId?: string,
): Promise<ComposerAccount[]> {
  const db = await getDb();
  const rows = await db.query.accounts.findMany({
    where: brandId ? (a, { eq }) => eq(a.brandId, brandId) : undefined,
    orderBy: (a, { asc }) => asc(a.sortOrder),
  });
  return rows.map((a) => ({
    id: a.id,
    platformId: a.platformId as PlatformId,
    handle: a.handle,
    displayName: a.displayName,
    avatarColor: a.avatarColor,
    mode: a.mode,
    postingEnabled: a.postingEnabled,
  }));
}

/**
 * Best posting hour (UTC) per account, learned from its own history:
 * the publish hour whose posts average the highest engagement rate.
 * Accounts without enough data (≥2 posts in some hour) get no entry —
 * the composer falls back to the master time for them.
 */
export async function getBestHours(
  accountIds: string[],
): Promise<Record<string, number>> {
  if (accountIds.length === 0) return {};
  const db = await getDb();
  const rows = await db
    .select({
      accountId: postTargets.accountId,
      publishedAt: postTargets.publishedAt,
      metrics: postTargets.metrics,
    })
    .from(postTargets)
    .where(
      and(
        inArray(postTargets.accountId, accountIds),
        eq(postTargets.status, "published"),
        isNotNull(postTargets.publishedAt),
        isNotNull(postTargets.metrics),
      ),
    );

  const buckets = new Map<string, Map<number, { sum: number; n: number }>>();
  for (const r of rows) {
    const er = r.metrics?.engagementRate;
    if (er == null || !r.publishedAt) continue;
    const hour = r.publishedAt.getUTCHours();
    const perAccount = buckets.get(r.accountId) ?? new Map();
    const b = perAccount.get(hour) ?? { sum: 0, n: 0 };
    b.sum += er;
    b.n += 1;
    perAccount.set(hour, b);
    buckets.set(r.accountId, perAccount);
  }

  const out: Record<string, number> = {};
  for (const [accountId, perHour] of buckets) {
    let bestHour = -1;
    let bestAvg = -1;
    for (const [hour, { sum, n }] of perHour) {
      if (n < 2) continue;
      const avg = sum / n;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestHour = hour;
      }
    }
    if (bestHour >= 0) out[accountId] = bestHour;
  }
  return out;
}

export async function getDraftInitial(
  postId: string,
): Promise<ComposerInitial | null> {
  const db = await getDb();
  const post = await db.query.posts.findFirst({
    where: (p, { eq }) => eq(p.id, postId),
    with: {
      media: { with: { asset: true } },
      targets: true,
    },
  });
  if (!post) return null;
  // Only drafts and scheduled posts are editable in the composer.
  if (!["draft", "scheduled"].includes(post.status)) return null;
  return {
    postId: post.id,
    caption: post.caption,
    mediaIds: [...post.media]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => m.mediaAssetId),
    targets: post.targets.map((t) => ({
      accountId: t.accountId,
      caption: t.variantCaption,
      meta: t.variantMeta,
    })),
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
  };
}
