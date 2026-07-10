import type { NormalizedAccountStats } from "../types";

/**
 * Deterministic pseudo-random demo data. Every value is a pure function of
 * (accountKey, calendar date), so re-seeding or re-syncing always produces
 * the same series, and "today" extends yesterday's curve smoothly.
 */

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One PRNG per (key, date) — deterministic per calendar day. */
export function dayRand(key: string, isoDate: string) {
  return mulberry32(xmur3(`${key}|${isoDate}`)());
}

export function stableRand(key: string) {
  return mulberry32(xmur3(key)());
}

const EPOCH = Date.UTC(2026, 0, 1); // fixed growth anchor

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return isoDay(d);
}

export interface DemoProfile {
  baseFollowers: number;
  dailyGrowthPct: number; // e.g. 0.35 → 0.35%/day average
  volatility: number; // 0..1
  erBase: number; // engagement / impressions, e.g. 0.045
  impressionsPerFollower: number;
  viralChance: number; // probability per day of a spike
  video: boolean;
}

export function statsForDay(
  key: string,
  profile: DemoProfile,
  isoDate: string,
): NormalizedAccountStats {
  const rand = dayRand(key, isoDate);
  const dayIndex = Math.max(
    0,
    Math.round((Date.parse(isoDate) - EPOCH) / 86_400_000),
  );

  const growth = Math.pow(1 + profile.dailyGrowthPct / 100, dayIndex);
  const wobble = 1 + (rand() - 0.5) * 0.02 * profile.volatility;
  const followers = Math.round(profile.baseFollowers * growth * wobble);

  const weekday = new Date(isoDate).getUTCDay();
  const weekdayFactor = [0.85, 0.95, 1, 1.02, 1.05, 1.15, 1.1][weekday];
  const viral = rand() < profile.viralChance ? 2.5 + rand() * 5 : 1;
  const noise = 0.6 + rand() * 0.9;

  const impressions = Math.round(
    followers *
      profile.impressionsPerFollower *
      weekdayFactor *
      noise *
      viral,
  );
  const reach = Math.round(impressions * (0.62 + rand() * 0.18));
  const er = profile.erBase * (0.75 + rand() * 0.6) * (viral > 1 ? 1.25 : 1);
  const engagements = Math.round(impressions * er);
  const likes = Math.round(engagements * 0.7);
  const comments = Math.round(engagements * 0.08);
  const shares = Math.round(engagements * 0.1);
  const saves = Math.max(0, engagements - likes - comments - shares);

  const stats: NormalizedAccountStats = {
    date: isoDate,
    followers,
    following: Math.round(followers * 0.02) + 180,
    postCount: 40 + Math.floor(dayIndex / 3),
    impressions,
    reach,
    profileViews: Math.round(reach * 0.06),
    engagements,
    likes,
    comments,
    shares,
    saves,
  };
  if (profile.video) {
    stats.videoViews = Math.round(impressions * (0.8 + rand() * 0.3));
    stats.watchTimeSec = Math.round(
      (stats.videoViews ?? 0) * (8 + rand() * 26),
    );
  }
  return stats;
}

export function statsRange(
  key: string,
  profile: DemoProfile,
  sinceDate: string,
): NormalizedAccountStats[] {
  const out: NormalizedAccountStats[] = [];
  const cursor = new Date(`${sinceDate}T00:00:00Z`);
  const today = new Date(`${daysAgo(0)}T00:00:00Z`);
  while (cursor <= today) {
    out.push(statsForDay(key, profile, isoDay(cursor)));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Deterministic per-post metrics for demo history / demo post syncs. */
export function postMetricsFor(
  key: string,
  profile: DemoProfile,
  isoDate: string,
  slot: number,
) {
  const rand = dayRand(`${key}|post${slot}`, isoDate);
  const day = statsForDay(key, profile, isoDate);
  const share = 0.25 + rand() * 0.6;
  const impressions = Math.max(
    50,
    Math.round((day.impressions ?? 1000) * share),
  );
  const er = profile.erBase * (0.6 + rand() * 1.4);
  const engagements = Math.round(impressions * er);
  const likes = Math.round(engagements * 0.72);
  const comments = Math.round(engagements * 0.09);
  const shares = Math.round(engagements * 0.11);
  const saves = Math.max(0, engagements - likes - comments - shares);
  return {
    impressions,
    likes,
    comments,
    shares,
    saves,
    videoViews: profile.video
      ? Math.round(impressions * (0.75 + rand() * 0.3))
      : undefined,
    engagementRate: Number(((engagements / Math.max(1, impressions)) * 100).toFixed(2)),
  };
}
