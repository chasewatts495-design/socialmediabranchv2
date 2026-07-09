import type { PlatformId } from "../types";
import { stableRand, type DemoProfile } from "./generators";

/** PRNG key shared by the seed and the DemoConnector. */
export function demoKey(platformId: PlatformId, handle: string): string {
  return `${platformId}:${handle.toLowerCase()}`;
}

const BASE: Record<PlatformId, DemoProfile> = {
  instagram: {
    baseFollowers: 8000,
    dailyGrowthPct: 0.25,
    volatility: 0.6,
    erBase: 0.038,
    impressionsPerFollower: 0.5,
    viralChance: 0.02,
    video: true,
  },
  facebook: {
    baseFollowers: 6000,
    dailyGrowthPct: 0.08,
    volatility: 0.4,
    erBase: 0.02,
    impressionsPerFollower: 0.3,
    viralChance: 0.01,
    video: true,
  },
  tiktok: {
    baseFollowers: 12000,
    dailyGrowthPct: 0.7,
    volatility: 1,
    erBase: 0.058,
    impressionsPerFollower: 1.5,
    viralChance: 0.05,
    video: true,
  },
  x: {
    baseFollowers: 4000,
    dailyGrowthPct: 0.12,
    volatility: 0.8,
    erBase: 0.017,
    impressionsPerFollower: 0.9,
    viralChance: 0.02,
    video: false,
  },
  youtube: {
    baseFollowers: 2500,
    dailyGrowthPct: 0.4,
    volatility: 0.5,
    erBase: 0.034,
    impressionsPerFollower: 2,
    viralChance: 0.018,
    video: true,
  },
  reddit: {
    baseFollowers: 1500,
    dailyGrowthPct: 0.1,
    volatility: 0.9,
    erBase: 0.05,
    impressionsPerFollower: 1.1,
    viralChance: 0.03,
    video: false,
  },
  pinterest: {
    baseFollowers: 3000,
    dailyGrowthPct: 0.11,
    volatility: 0.3,
    erBase: 0.027,
    impressionsPerFollower: 1.3,
    viralChance: 0.008,
    video: false,
  },
  snapchat: {
    baseFollowers: 2000,
    dailyGrowthPct: 0.05,
    volatility: 0.4,
    erBase: 0.03,
    impressionsPerFollower: 0.8,
    viralChance: 0.005,
    video: true,
  },
};

/** Hand-tuned profiles for the seeded demo brand, keyed by demoKey(). */
const KNOWN: Record<string, DemoProfile> = {
  "instagram:@aurora.collective": {
    ...BASE.instagram,
    baseFollowers: 12400,
    dailyGrowthPct: 0.32,
    erBase: 0.041,
    viralChance: 0.03,
  },
  "facebook:aurora collective": {
    ...BASE.facebook,
    baseFollowers: 8600,
    erBase: 0.021,
  },
  "tiktok:@auroracollective": {
    ...BASE.tiktok,
    baseFollowers: 23800,
    dailyGrowthPct: 0.85,
    erBase: 0.062,
    viralChance: 0.06,
  },
  "x:@auroracollective": {
    ...BASE.x,
    baseFollowers: 5300,
    dailyGrowthPct: 0.15,
    erBase: 0.018,
    viralChance: 0.025,
  },
  "youtube:aurora studio": {
    ...BASE.youtube,
    baseFollowers: 3500,
    dailyGrowthPct: 0.45,
    erBase: 0.035,
  },
  "reddit:u/auroracollective": {
    ...BASE.reddit,
    baseFollowers: 1900,
  },
  "pinterest:@auroracollective": {
    ...BASE.pinterest,
    baseFollowers: 4200,
    dailyGrowthPct: 0.12,
    erBase: 0.028,
  },
  "snapchat:@auroracollective": {
    ...BASE.snapchat,
    baseFollowers: 2700,
  },
  "instagram:@aurora.outlet": {
    ...BASE.instagram,
    baseFollowers: 3900,
    dailyGrowthPct: 0.2,
    erBase: 0.033,
    viralChance: 0.015,
  },
  "tiktok:@aurora.bts": {
    ...BASE.tiktok,
    baseFollowers: 7200,
    dailyGrowthPct: 0.55,
    erBase: 0.055,
    viralChance: 0.045,
  },
};

/**
 * Deterministic demo profile for ANY account (including platforms/handles
 * the owner adds later while still in demo mode).
 */
export function profileFor(platformId: PlatformId, handle: string): DemoProfile {
  const key = demoKey(platformId, handle);
  const known = KNOWN[key];
  if (known) return known;
  const rand = stableRand(key);
  const base = BASE[platformId];
  return {
    ...base,
    baseFollowers: Math.round(base.baseFollowers * (0.4 + rand() * 1.8)),
    dailyGrowthPct: base.dailyGrowthPct * (0.6 + rand() * 0.9),
    erBase: base.erBase * (0.7 + rand() * 0.7),
    viralChance: base.viralChance * (0.5 + rand()),
  };
}

export const DEMO_EXTERNAL_URL: Record<PlatformId, (id: string) => string> = {
  instagram: (i) => `https://instagram.com/p/DEMO${i}`,
  facebook: (i) => `https://facebook.com/aurora/posts/DEMO${i}`,
  tiktok: (i) => `https://tiktok.com/@demo/video/DEMO${i}`,
  x: (i) => `https://x.com/demo/status/DEMO${i}`,
  youtube: (i) => `https://youtube.com/watch?v=DEMO${i}`,
  reddit: (i) => `https://reddit.com/r/demo/comments/DEMO${i}`,
  pinterest: (i) => `https://pinterest.com/pin/DEMO${i}`,
  snapchat: (i) => `https://snapchat.com/add/demo#${i}`,
};
