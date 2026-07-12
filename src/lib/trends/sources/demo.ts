import type { TrendSignal } from "../types";
import type { PlatformId } from "@/lib/connectors/types";

/**
 * Deterministic demo signals — the radar always has something honest to
 * show before any platform is connected (and in tests). Same keyword →
 * same output, clearly labeled source: "demo".
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const HOOKS = [
  "I tested {kw} for 30 days — here's what nobody tells you",
  "The {kw} mistake everyone makes in the first week",
  "POV: your first {kw} setup actually works",
  "{kw} on a $0 budget — full breakdown",
  "Why {kw} is blowing up right now (3 reasons)",
  "We ranked every {kw} trick — #2 felt illegal",
  "Stop doing {kw} like it's 2023",
  "The 15-second {kw} routine with insane results",
  "{kw} before vs after — wait for it",
  "Beginner {kw} tier list (brutally honest)",
  "What 1,000 hours of {kw} taught me in 60 seconds",
  "The {kw} supply list I wish I had on day one",
];

const PLATFORM_MIX: { platformId: PlatformId; mediaType: TrendSignal["mediaType"] }[] = [
  { platformId: "reddit", mediaType: "text" },
  { platformId: "youtube", mediaType: "video" },
  { platformId: "instagram", mediaType: "image" },
  { platformId: "tiktok", mediaType: "video" },
];

export function demoSignals(keyword: string): TrendSignal[] {
  const kw = keyword.trim().toLowerCase();
  const seed = hash(kw);
  const out: TrendSignal[] = [];
  for (let i = 0; i < 12; i++) {
    const r = hash(`${kw}:${i}`);
    const mix = PLATFORM_MIX[i % PLATFORM_MIX.length];
    // >>> 0 — XOR yields a SIGNED 32-bit int; unsigned keeps % positive.
    const score = 500 + (((r ^ seed) >>> 0) % 48_000);
    const hoursAgo = 3 + (r % 120);
    out.push({
      platformId: mix.platformId,
      keyword: kw,
      title: HOOKS[(r + i) % HOOKS.length].replace(/\{kw\}/g, kw),
      url: `https://example.com/demo/${kw.replace(/\s+/g, "-")}/${i}`,
      author: `creator_${(r % 899) + 100}`,
      postedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
      mediaType: mix.mediaType,
      engagement: {
        score,
        comments: Math.floor(score / 18),
        views: mix.mediaType === "video" ? score * 40 : undefined,
      },
      heat: 0, // ranked later
      source: "demo",
    });
  }
  return out;
}
