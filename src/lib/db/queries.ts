import { and, desc, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "./client";
import {
  accounts,
  activityLog,
  metricSnapshots,
  postTargets,
  posts,
} from "./schema";
import type { PlatformId } from "@/lib/connectors/types";
import { daysAgo } from "@/lib/connectors/demo/generators";
import { engagementRate } from "@/lib/metrics/engagement";

export type AccountRow = typeof accounts.$inferSelect;
export type SnapshotRow = typeof metricSnapshots.$inferSelect;

export interface DashboardAccount extends AccountRow {
  latest: SnapshotRow | null;
  rangeStart: SnapshotRow | null;
  sparkline: { date: string; followers: number }[];
  engagementRate: number | null;
}

export interface TopPost {
  targetId: string;
  postId: string;
  caption: string;
  accountHandle: string;
  accountId: string;
  platformId: PlatformId;
  publishedAt: Date | null;
  externalUrl: string | null;
  thumbnailUrl: string | null;
  metrics: {
    impressions?: number;
    likes?: number;
    comments?: number;
    engagementRate?: number;
  } | null;
}

export interface DashboardData {
  rangeDays: number;
  accounts: DashboardAccount[];
  followerTrend: Array<Record<string, number | string>>;
  platformsInTrend: PlatformId[];
  engagementByPlatform: { platformId: PlatformId; er: number | null }[];
  totals: {
    followers: number;
    followersPrev: number;
    reach: number;
    reachPrev: number;
    impressions: number;
    impressionsPrev: number;
    er: number | null;
    erPrev: number | null;
  };
  totalFollowerSpark: { date: string; value: number }[];
  topPosts: TopPost[];
  activity: (typeof activityLog.$inferSelect)[];
}

export async function getDashboardData(
  rangeDays: number,
  brandId?: string,
): Promise<DashboardData> {
  const db = await getDb();
  const since = daysAgo(rangeDays - 1);
  const sincePrev = daysAgo(rangeDays * 2 - 1);

  const accountRows = await db
    .select()
    .from(accounts)
    .where(brandId ? eq(accounts.brandId, brandId) : undefined)
    .orderBy(accounts.sortOrder);
  const accountIds = accountRows.map((a) => a.id);

  const snapshots = accountIds.length
    ? await db
        .select()
        .from(metricSnapshots)
        .where(
          and(
            gte(metricSnapshots.date, sincePrev),
            inArray(metricSnapshots.accountId, accountIds),
          ),
        )
        .orderBy(metricSnapshots.date)
    : [];

  const byAccount = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    const arr = byAccount.get(s.accountId) ?? [];
    arr.push(s);
    byAccount.set(s.accountId, arr);
  }

  const dashAccounts: DashboardAccount[] = accountRows.map((a) => {
    const rows = byAccount.get(a.id) ?? [];
    const inRange = rows.filter((r) => r.date >= since);
    const latest = inRange.at(-1) ?? rows.at(-1) ?? null;
    const rangeStart = inRange[0] ?? null;
    const sums = inRange.reduce(
      (acc, r) => ({
        engagements: acc.engagements + (r.engagements ?? 0),
        reach: acc.reach + (r.reach ?? 0),
        impressions: acc.impressions + (r.impressions ?? 0),
      }),
      { engagements: 0, reach: 0, impressions: 0 },
    );
    return {
      ...a,
      latest,
      rangeStart,
      sparkline: inRange
        .filter((r) => r.followers != null)
        .map((r) => ({ date: r.date, followers: r.followers! })),
      engagementRate: engagementRate({
        engagements: sums.engagements || null,
        reach: sums.reach || null,
        impressions: sums.impressions || null,
        followers: latest?.followers,
      }),
    };
  });

  // Follower trend per platform per day (accounts summed).
  const platformDaily = new Map<string, Map<PlatformId, number>>();
  const platformsSeen = new Set<PlatformId>();
  for (const a of accountRows) {
    const rows = byAccount.get(a.id) ?? [];
    for (const r of rows) {
      if (r.date < since || r.followers == null) continue;
      const day = platformDaily.get(r.date) ?? new Map();
      const pid = a.platformId as PlatformId;
      day.set(pid, (day.get(pid) ?? 0) + r.followers);
      platformDaily.set(r.date, day);
      platformsSeen.add(pid);
    }
  }
  const followerTrend = [...platformDaily.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, perPlatform]) => {
      const row: Record<string, number | string> = { date };
      for (const [pid, v] of perPlatform) row[pid] = v;
      return row;
    });

  // Engagement rate per platform over the range.
  const perPlatformSums = new Map<
    PlatformId,
    { engagements: number; reach: number; impressions: number }
  >();
  for (const a of accountRows) {
    const rows = (byAccount.get(a.id) ?? []).filter((r) => r.date >= since);
    const pid = a.platformId as PlatformId;
    const acc =
      perPlatformSums.get(pid) ?? { engagements: 0, reach: 0, impressions: 0 };
    for (const r of rows) {
      acc.engagements += r.engagements ?? 0;
      acc.reach += r.reach ?? 0;
      acc.impressions += r.impressions ?? 0;
    }
    perPlatformSums.set(pid, acc);
  }
  const engagementByPlatform = [...perPlatformSums.entries()].map(
    ([platformId, s]) => ({
      platformId,
      er: engagementRate({
        engagements: s.engagements || null,
        reach: s.reach || null,
        impressions: s.impressions || null,
        followers: null,
      }),
    }),
  );

  // Totals + previous-window comparisons.
  let followers = 0;
  let followersPrev = 0;
  const windowSums = { reach: 0, impressions: 0, engagements: 0 };
  const prevSums = { reach: 0, impressions: 0, engagements: 0 };
  for (const a of dashAccounts) {
    followers += a.latest?.followers ?? 0;
    followersPrev += a.rangeStart?.followers ?? 0;
  }
  for (const s of snapshots) {
    const bucket = s.date >= since ? windowSums : prevSums;
    bucket.reach += s.reach ?? 0;
    bucket.impressions += s.impressions ?? 0;
    bucket.engagements += s.engagements ?? 0;
  }

  const totalsByDay = new Map<string, number>();
  for (const s of snapshots) {
    if (s.date < since || s.followers == null) continue;
    totalsByDay.set(s.date, (totalsByDay.get(s.date) ?? 0) + s.followers);
  }
  const totalFollowerSpark = [...totalsByDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value }));

  // Top posts by engagement rate in range.
  const sinceDate = new Date(`${since}T00:00:00Z`);
  const targets = await db
    .select({
      target: postTargets,
      account: accounts,
      caption: posts.caption,
    })
    .from(postTargets)
    .innerJoin(accounts, eq(postTargets.accountId, accounts.id))
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(
      and(
        eq(postTargets.status, "published"),
        isNotNull(postTargets.metrics),
        gte(postTargets.publishedAt, sinceDate),
        brandId ? eq(accounts.brandId, brandId) : undefined,
      ),
    );

  const db2 = await getDb();
  const postIds = [...new Set(targets.map((t) => t.target.postId))];
  const thumbs = new Map<string, string>();
  if (postIds.length) {
    const mediaRows = await db2.query.postMedia.findMany({
      where: (pm, { inArray: ia }) => ia(pm.postId, postIds),
      with: { asset: true },
      orderBy: (pm, { asc }) => asc(pm.sortOrder),
    });
    for (const m of mediaRows) {
      if (!thumbs.has(m.postId)) {
        thumbs.set(m.postId, m.asset.thumbnailUrl ?? m.asset.url);
      }
    }
  }

  const topPosts: TopPost[] = targets
    .map((t) => ({
      targetId: t.target.id,
      postId: t.target.postId,
      caption: t.caption,
      accountHandle: t.account.handle,
      accountId: t.account.id,
      platformId: t.account.platformId as PlatformId,
      publishedAt: t.target.publishedAt,
      externalUrl: t.target.externalUrl,
      thumbnailUrl: thumbs.get(t.target.postId) ?? null,
      metrics: t.target.metrics,
    }))
    .sort(
      (a, b) =>
        (b.metrics?.engagementRate ?? 0) - (a.metrics?.engagementRate ?? 0),
    )
    .slice(0, 5);

  // Brand scope keeps app-level events (null accountId) visible.
  const activity = await db
    .select()
    .from(activityLog)
    .where(
      brandId && accountIds.length
        ? or(
            isNull(activityLog.accountId),
            inArray(activityLog.accountId, accountIds),
          )
        : brandId
          ? isNull(activityLog.accountId)
          : undefined,
    )
    .orderBy(desc(activityLog.ts))
    .limit(6);

  const er = engagementRate({
    engagements: windowSums.engagements || null,
    reach: windowSums.reach || null,
    impressions: windowSums.impressions || null,
    followers: null,
  });
  const erPrev = engagementRate({
    engagements: prevSums.engagements || null,
    reach: prevSums.reach || null,
    impressions: prevSums.impressions || null,
    followers: null,
  });

  return {
    rangeDays,
    accounts: dashAccounts,
    followerTrend,
    platformsInTrend: [...platformsSeen],
    engagementByPlatform,
    totals: {
      followers,
      followersPrev,
      reach: windowSums.reach,
      reachPrev: prevSums.reach,
      impressions: windowSums.impressions,
      impressionsPrev: prevSums.impressions,
      er,
      erPrev,
    },
    totalFollowerSpark,
    topPosts,
    activity,
  };
}

export async function getAccountsWithPlatform(brandId?: string) {
  const db = await getDb();
  return db.query.accounts.findMany({
    where: brandId ? (a, { eq: eq_ }) => eq_(a.brandId, brandId) : undefined,
    with: { platform: true },
    orderBy: (a, { asc }) => asc(a.sortOrder),
  });
}
