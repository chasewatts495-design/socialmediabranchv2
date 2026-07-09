import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "./client";
import { metricSnapshots, postTargets, posts } from "./schema";
import type { SnapshotRow } from "./queries";
import { daysAgo } from "@/lib/connectors/demo/generators";
import { engagementRate } from "@/lib/metrics/engagement";
import type { PlatformId } from "@/lib/connectors/types";

export interface AccountPostRow {
  targetId: string;
  postId: string;
  caption: string;
  status: string;
  publishedAt: string | null; // ISO — serializable for client table
  externalUrl: string | null;
  thumbnailUrl: string | null;
  metrics: {
    impressions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    videoViews?: number;
    engagementRate?: number;
  } | null;
}

export async function getAccountDetail(accountId: string, rangeDays: number) {
  const db = await getDb();

  const account = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
    with: { platform: true },
  });
  if (!account) return null;

  const since = daysAgo(rangeDays - 1);
  const sincePrev = daysAgo(rangeDays * 2 - 1);

  const snapshots = await db
    .select()
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.accountId, accountId),
        gte(metricSnapshots.date, sincePrev),
      ),
    )
    .orderBy(metricSnapshots.date);

  const inRange = snapshots.filter((s) => s.date >= since);
  const prevRange = snapshots.filter((s) => s.date < since);

  const sum = (rows: SnapshotRow[], key: keyof SnapshotRow) =>
    rows.reduce((acc, r) => acc + ((r[key] as number | null) ?? 0), 0);

  const latest = inRange.at(-1) ?? snapshots.at(-1) ?? null;
  const rangeStart = inRange[0] ?? null;

  const totals = {
    followers: latest?.followers ?? null,
    followersStart: rangeStart?.followers ?? null,
    reach: sum(inRange, "reach"),
    reachPrev: sum(prevRange, "reach"),
    impressions: sum(inRange, "impressions"),
    impressionsPrev: sum(prevRange, "impressions"),
    engagements: sum(inRange, "engagements"),
    engagementsPrev: sum(prevRange, "engagements"),
    videoViews: sum(inRange, "videoViews"),
    watchTimeSec: sum(inRange, "watchTimeSec"),
    er: engagementRate({
      engagements: sum(inRange, "engagements") || null,
      reach: sum(inRange, "reach") || null,
      impressions: sum(inRange, "impressions") || null,
      followers: latest?.followers,
    }),
    erPrev: engagementRate({
      engagements: sum(prevRange, "engagements") || null,
      reach: sum(prevRange, "reach") || null,
      impressions: sum(prevRange, "impressions") || null,
      followers: rangeStart?.followers,
    }),
  };

  const series = inRange.map((s) => ({
    date: s.date,
    followers: s.followers ?? 0,
    impressions: s.impressions ?? 0,
    reach: s.reach ?? 0,
    likes: s.likes ?? 0,
    comments: s.comments ?? 0,
    shares: s.shares ?? 0,
    saves: s.saves ?? 0,
  }));

  // Posts published to this account.
  const targetRows = await db
    .select({ target: postTargets, caption: posts.caption, status: posts.status })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(eq(postTargets.accountId, accountId))
    .orderBy(desc(postTargets.publishedAt))
    .limit(60);

  const postIds = [...new Set(targetRows.map((t) => t.target.postId))];
  const thumbs = new Map<string, string>();
  if (postIds.length) {
    const mediaRows = await db.query.postMedia.findMany({
      where: (pm, { inArray }) => inArray(pm.postId, postIds),
      with: { asset: true },
      orderBy: (pm, { asc }) => asc(pm.sortOrder),
    });
    for (const m of mediaRows) {
      if (!thumbs.has(m.postId)) {
        thumbs.set(m.postId, m.asset.thumbnailUrl ?? m.asset.url);
      }
    }
  }

  const accountPosts: AccountPostRow[] = targetRows.map((t) => ({
    targetId: t.target.id,
    postId: t.target.postId,
    caption: t.caption,
    status: t.target.status,
    publishedAt: t.target.publishedAt?.toISOString() ?? null,
    externalUrl: t.target.externalUrl,
    thumbnailUrl: thumbs.get(t.target.postId) ?? null,
    metrics: t.target.metrics,
  }));

  return {
    account: {
      ...account,
      platformId: account.platformId as PlatformId,
    },
    totals,
    series,
    posts: accountPosts,
    hasVideo: inRange.some((s) => (s.videoViews ?? 0) > 0),
  };
}
