import type { PlatformId } from "@/lib/connectors/types";

/**
 * Chart series colors — validated with the dataviz palette checker against
 * the dark surface (#121722): OKLCH lightness band, chroma floor, CVD
 * adjacent-pair separation (worst ΔE 15.1), and ≥3:1 contrast all pass.
 * Brand-adjacent, not exact brand hexes (those live in BADGE colors below,
 * where color never carries data alone).
 */
export const PLATFORM_CHART_COLORS: Record<PlatformId, string> = {
  instagram: "#f0537a",
  facebook: "#3d87f5",
  tiktok: "#0095b0",
  x: "#8b5cf6",
  youtube: "#e04b36",
  reddit: "#d96a0f",
  pinterest: "#cc2957",
  snapchat: "#a89100",
};

/** True brand colors for avatars/badges (identity is also in the label). */
export const PLATFORM_BADGE_COLORS: Record<PlatformId, string> = {
  instagram: "#e4405f",
  facebook: "#1877f2",
  tiktok: "#22d3ee",
  x: "#cbd5e1",
  youtube: "#ff4d4d",
  reddit: "#ff4500",
  pinterest: "#e60023",
  snapchat: "#fffc00",
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
