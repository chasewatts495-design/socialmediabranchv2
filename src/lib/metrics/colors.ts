import type { PlatformId } from "@/lib/connectors/types";

/**
 * Chart series colors — validated with the dataviz palette checker against
 * the light surfaces (#ffffff cards and #f4f5f7 page): OKLCH lightness band,
 * chroma floor, CVD adjacent-pair separation (worst ΔE 13.3), and ≥3:1
 * contrast all pass. Brand-adjacent, not exact brand hexes (those live in
 * BADGE colors below, where color never carries data alone).
 */
export const PLATFORM_CHART_COLORS: Record<PlatformId, string> = {
  instagram: "#c22b5f",
  facebook: "#1b64c8",
  tiktok: "#0087a3",
  x: "#6d3fd4",
  youtube: "#d63a2f",
  reddit: "#7a3f00",
  pinterest: "#a30f3b",
  snapchat: "#8a7500",
};

/** True brand colors for avatars/badges (identity is also in the label). */
export const PLATFORM_BADGE_COLORS: Record<PlatformId, string> = {
  instagram: "#e4405f",
  facebook: "#1877f2",
  tiktok: "#00879b",
  x: "#111827",
  youtube: "#e02f2f",
  reddit: "#ff4500",
  pinterest: "#e60023",
  snapchat: "#c7b000",
};

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  reddit: "Reddit",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
};
