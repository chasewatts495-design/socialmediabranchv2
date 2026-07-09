import { and, gte, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { metricSnapshots } from "@/lib/db/schema";
import type { PlatformId } from "@/lib/connectors/types";
import { daysAgo } from "@/lib/connectors/demo/generators";
import { engagementRate } from "./engagement";

/**
 * The compact, precomputed JSON handed to the AI strategist (and the demo
 * analysis engine). Signals over spreadsheets: deltas, mixes, histograms,
 * and z-score anomalies are computed here in TypeScript.
 */

export interface AccountSummary {
  accountId: string;
  handle: string;
  platform: PlatformId;
  mode: string;
  followers: { now: number | null; d30Delta: number | null; d30Pct: number | null };
  avgEngagementRate: { d30: number | null; prev30: number | null };
  reach: { d7: number; d30: number; trend: "up" | "down" | "flat" };
  cadence: { postsPerWeekD30: number; gapDaysMax: number };
  formatMix: Record<string, number>;
  postingTimeHistogram: { morning: number; midday: number; evening: number; night: number };
  topPosts: {
    caption: string;
    format: string;
    er: number | null;
    impressions: number | null;
    publishedAt: string;
    hour: number;
  }[];
  bottomPosts: { caption: string; format: string; er: number | null }[];
  anomalies: string[];
}

export interface MetricSummary {
  generatedAt: string;
  rangeDays: number;
  accounts: AccountSummary[];
  crossPlatform: {
    bestPlatformByER: string | null;
    fastestGrowing: string | null;
    underperforming: string[];
  };
}

function timeBucket(hour: number): keyof AccountSummary["postingTimeHistogram"] {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "midday";
  if (hour >= 16 && hour < 22) return "evening";
  return "night";
}

export async function buildMetricSummary(
  opts: { accountIds?: string[]; rangeDays?: number } = {},
): Promise<MetricSummary> {
  const db = await getDb();
  const rangeDays = opts.rangeDays ?? 90;
  const since = daysAgo(rangeDays - 1);
  const since30 = daysAgo(29);
  const since7 = daysAgo(6);
  const sincePrev30 = daysAgo(59);

  let accountRows = await db.query.accounts.findMany({
    orderBy: (a, { asc }) => asc(a.sortOrder),
  });
  if (opts.accountIds?.length) {
    accountRows = accountRows.filter((a) => opts.accountIds!.includes(a.id));
  }
  const ids = accountRows.map((a) => a.id);
  if (ids.length === 0) {
    return {
      generatedAt: daysAgo(0),
      rangeDays,
      accounts: [],
      crossPlatform: { bestPlatformByER: null, fastestGrowing: null, underperforming: [] },
    };
  }

  const snapshots = await db
    .select()
    .from(metricSnapshots)
    .where(
      and(gte(metricSnapshots.date, since), inArray(metricSnapshots.accountId, ids)),
    )
    .orderBy(metricSnapshots.date);

  const targetRows = await db.query.postTargets.findMany({
    where: (t, { inArray: ia, eq, and: a }) =>
      a(ia(t.accountId, ids), eq(t.status, "published")),
    with: { post: { with: { media: { with: { asset: true } } } } },
  });

  const summaries: AccountSummary[] = [];

  for (const account of accountRows) {
    const snaps = snapshots.filter((s) => s.accountId === account.id);
    const s30 = snaps.filter((s) => s.date >= since30);
    const sPrev30 = snaps.filter((s) => s.date >= sincePrev30 && s.date < since30);
    const s7 = snaps.filter((s) => s.date >= since7);

    const latest = snaps.at(-1) ?? null;
    const at30 = s30[0] ?? null;
    const sum = (rows: typeof snaps, key: "reach" | "impressions" | "engagements") =>
      rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);

    const er30 = engagementRate({
      engagements: sum(s30, "engagements") || null,
      reach: sum(s30, "reach") || null,
      impressions: sum(s30, "impressions") || null,
      followers: latest?.followers,
    });
    const erPrev30 = engagementRate({
      engagements: sum(sPrev30, "engagements") || null,
      reach: sum(sPrev30, "reach") || null,
      impressions: sum(sPrev30, "impressions") || null,
      followers: at30?.followers,
    });

    const reach7 = sum(s7, "reach");
    const reach30 = sum(s30, "reach");
    const firstHalf = sum(
      s30.filter((s) => s.date < daysAgo(14)),
      "reach",
    );
    const secondHalf = sum(
      s30.filter((s) => s.date >= daysAgo(14)),
      "reach",
    );
    const trend: "up" | "down" | "flat" =
      secondHalf > firstHalf * 1.1 ? "up" : secondHalf < firstHalf * 0.9 ? "down" : "flat";

    // Posts for this account.
    const accountTargets = targetRows
      .filter((t) => t.accountId === account.id && t.publishedAt)
      .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime());

    const last30Targets = accountTargets.filter(
      (t) => t.publishedAt! >= new Date(`${since30}T00:00:00Z`),
    );

    // Cadence.
    const postsPerWeekD30 = Number(((last30Targets.length / 30) * 7).toFixed(1));
    let gapDaysMax = 0;
    for (let i = 1; i < accountTargets.length && i < 30; i++) {
      const gap =
        (accountTargets[i - 1].publishedAt!.getTime() -
          accountTargets[i].publishedAt!.getTime()) /
        86_400_000;
      gapDaysMax = Math.max(gapDaysMax, Math.round(gap));
    }

    // Format mix + posting-time histogram.
    const histogram = { morning: 0, midday: 0, evening: 0, night: 0 };
    const formatCounts = new Map<string, number>();
    const postFormat = (t: (typeof accountTargets)[number]): string => {
      const asset = t.post.media[0]?.asset;
      if (!asset) return "text";
      return asset.mimeType.startsWith("video/") ? "video" : "image";
    };
    for (const t of accountTargets.slice(0, 40)) {
      histogram[timeBucket(t.publishedAt!.getUTCHours())] += 1;
      const f = postFormat(t);
      formatCounts.set(f, (formatCounts.get(f) ?? 0) + 1);
    }
    const totalFormats = [...formatCounts.values()].reduce((a, b) => a + b, 0) || 1;
    const formatMix: Record<string, number> = {};
    for (const [k, v] of formatCounts) {
      formatMix[k] = Number((v / totalFormats).toFixed(2));
    }

    // Top/bottom posts by ER.
    const withEr = accountTargets
      .filter((t) => t.metrics?.engagementRate != null)
      .sort((a, b) => (b.metrics!.engagementRate ?? 0) - (a.metrics!.engagementRate ?? 0));
    const mapPost = (t: (typeof withEr)[number]) => ({
      caption: (t.post.caption || "").slice(0, 80),
      format: postFormat(t),
      er: t.metrics?.engagementRate ?? null,
      impressions: t.metrics?.impressions ?? null,
      publishedAt: t.publishedAt!.toISOString().slice(0, 10),
      hour: t.publishedAt!.getUTCHours(),
    });

    // Anomalies: impressions z-score vs trailing 28-day window.
    const anomalies: string[] = [];
    for (let i = 28; i < snaps.length; i++) {
      const window = snaps.slice(i - 28, i).map((s) => s.impressions ?? 0);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const std =
        Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length) || 1;
      const today = snaps[i].impressions ?? 0;
      const z = (today - mean) / std;
      if (z > 2.5 && anomalies.length < 3) {
        anomalies.push(
          `${snaps[i].date}: impressions spiked ${(today / Math.max(1, mean)).toFixed(1)}x above baseline`,
        );
      }
    }

    summaries.push({
      accountId: account.id,
      handle: account.handle,
      platform: account.platformId as PlatformId,
      mode: account.mode,
      followers: {
        now: latest?.followers ?? null,
        d30Delta:
          latest?.followers != null && at30?.followers != null
            ? latest.followers - at30.followers
            : null,
        d30Pct:
          latest?.followers != null && at30?.followers
            ? Number((((latest.followers - at30.followers) / at30.followers) * 100).toFixed(1))
            : null,
      },
      avgEngagementRate: {
        d30: er30 != null ? Number(er30.toFixed(2)) : null,
        prev30: erPrev30 != null ? Number(erPrev30.toFixed(2)) : null,
      },
      reach: { d7: reach7, d30: reach30, trend },
      cadence: { postsPerWeekD30, gapDaysMax },
      formatMix,
      postingTimeHistogram: histogram,
      topPosts: withEr.slice(0, 3).map(mapPost),
      bottomPosts: withEr.slice(-2).map((t) => ({
        caption: (t.post.caption || "").slice(0, 80),
        format: postFormat(t),
        er: t.metrics?.engagementRate ?? null,
      })),
      anomalies,
    });
  }

  // Cross-platform highlights.
  const byEr = [...summaries].sort(
    (a, b) => (b.avgEngagementRate.d30 ?? 0) - (a.avgEngagementRate.d30 ?? 0),
  );
  const byGrowth = [...summaries].sort(
    (a, b) => (b.followers.d30Pct ?? 0) - (a.followers.d30Pct ?? 0),
  );
  const under = summaries
    .filter(
      (s) =>
        (s.avgEngagementRate.d30 ?? 0) <
          (s.avgEngagementRate.prev30 ?? 0) * 0.85 || s.reach.trend === "down",
    )
    .map((s) => s.handle);

  return {
    generatedAt: daysAgo(0),
    rangeDays,
    accounts: summaries,
    crossPlatform: {
      bestPlatformByER: byEr[0]?.handle ?? null,
      fastestGrowing: byGrowth[0]?.handle ?? null,
      underperforming: under.slice(0, 3),
    },
  };
}
