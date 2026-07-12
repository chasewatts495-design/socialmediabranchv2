import type { PlatformId } from "@/lib/connectors/types";

/**
 * Trend Radar: keyword → viral signals from every platform we can reach →
 * AI pattern analysis → creative briefs tuned to the owner's accounts.
 */

export interface TrendSignal {
  platformId: PlatformId;
  keyword: string;
  title: string;
  url: string;
  author: string;
  /** ISO timestamp of the original post. */
  postedAt: string;
  mediaType: "video" | "image" | "text" | "link";
  thumb?: string;
  engagement: {
    /** Platform-native headline number (upvotes, likes, views). */
    score: number;
    comments?: number;
    views?: number;
  };
  /** 0..1 rank within its own platform's batch — comparable across platforms. */
  heat: number;
  source: "live" | "demo";
}

export interface TrendPattern {
  name: string;
  why: string;
  playbook: string;
}

export interface CreativeBrief {
  title: string;
  hook: string;
  caption: string;
  platformId: PlatformId;
  bestHourUtc?: number;
}

export interface TrendReport {
  summary: string;
  patterns: TrendPattern[];
  briefs: CreativeBrief[];
  generatedBy: "claude" | "demo";
}

export interface TrendSource {
  platformId: PlatformId;
  label: string;
  /** Truthful availability — live creds on file, or a public API. */
  available(): Promise<boolean>;
  /** Hint shown when unavailable ("Connect YouTube first"). */
  unavailableHint: string;
  scan(keyword: string): Promise<TrendSignal[]>;
}
