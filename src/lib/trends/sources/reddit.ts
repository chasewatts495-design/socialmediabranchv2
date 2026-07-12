import { liveFetch } from "@/lib/connectors/live/http";
import type { TrendSignal, TrendSource } from "../types";

/**
 * Reddit's search works without any credentials (public JSON API with a
 * descriptive User-Agent), so the radar has a real live source from day
 * one. Top posts of the week + hot posts, merged and de-duped.
 */

const UA = "web:branch-social-command:v1.0 (trend radar)";

interface RedditChild {
  kind: string;
  data: {
    title?: string;
    permalink?: string;
    author?: string;
    created_utc?: number;
    score?: number;
    num_comments?: number;
    post_hint?: string;
    is_video?: boolean;
    thumbnail?: string;
    subreddit?: string;
    over_18?: boolean;
    stickied?: boolean;
  };
}

interface RedditListing {
  data?: { children?: RedditChild[] };
}

function toSignal(keyword: string, c: RedditChild): TrendSignal | null {
  const d = c.data;
  if (!d?.title || !d.permalink || d.over_18 || d.stickied) return null;
  const mediaType: TrendSignal["mediaType"] = d.is_video
    ? "video"
    : d.post_hint === "image"
      ? "image"
      : d.post_hint === "link"
        ? "link"
        : "text";
  return {
    platformId: "reddit",
    keyword,
    title: d.title.slice(0, 220),
    url: `https://www.reddit.com${d.permalink}`,
    author: d.subreddit ? `r/${d.subreddit}` : (d.author ?? "unknown"),
    postedAt: new Date((d.created_utc ?? 0) * 1000).toISOString(),
    mediaType,
    thumb: d.thumbnail?.startsWith("http") ? d.thumbnail : undefined,
    engagement: { score: d.score ?? 0, comments: d.num_comments ?? 0 },
    heat: 0,
    source: "live",
  };
}

async function search(keyword: string, sort: "top" | "hot"): Promise<TrendSignal[]> {
  const q = new URLSearchParams({
    q: keyword,
    sort,
    t: "week",
    limit: "25",
    raw_json: "1",
  });
  const listing = await liveFetch<RedditListing>(
    `https://www.reddit.com/search.json?${q}`,
    { headers: { "User-Agent": UA } },
  );
  return (listing.data?.children ?? [])
    .map((c) => toSignal(keyword, c))
    .filter((s): s is TrendSignal => s !== null);
}

export const redditTrendSource: TrendSource = {
  platformId: "reddit",
  label: "Reddit (public search)",
  unavailableHint: "",
  async available() {
    return true;
  },
  async scan(keyword) {
    const [top, hot] = await Promise.allSettled([
      search(keyword, "top"),
      search(keyword, "hot"),
    ]);
    const merged = new Map<string, TrendSignal>();
    for (const batch of [top, hot]) {
      if (batch.status !== "fulfilled") continue;
      for (const s of batch.value) merged.set(s.url, s);
    }
    // If both requests failed, surface the first error so the scan can
    // record an honest per-platform failure.
    if (merged.size === 0 && top.status === "rejected") throw top.reason;
    return [...merged.values()]
      .sort((a, b) => b.engagement.score - a.engagement.score)
      .slice(0, 20);
  },
};
