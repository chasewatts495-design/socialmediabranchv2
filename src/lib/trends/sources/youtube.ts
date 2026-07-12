import { getDb } from "@/lib/db/client";
import { contextFor } from "@/lib/scheduler/jobs";
import { freshOAuthPayload } from "@/lib/connectors/live/base";
import { liveFetch } from "@/lib/connectors/live/http";
import type { TrendSignal, TrendSource } from "../types";

/**
 * YouTube keyword scan through the owner's connected Google account:
 * search.list ordered by viewCount over the last 14 days, hydrated with
 * videos.list statistics.
 */

const API = "https://www.googleapis.com/youtube/v3";

async function liveYoutubeAccount() {
  const db = await getDb();
  return db.query.accounts.findFirst({
    where: (a, { and: and2, eq: eq2 }) =>
      and2(eq2(a.platformId, "youtube"), eq2(a.mode, "live")),
  });
}

interface SearchItem {
  id?: { videoId?: string };
}
interface VideoItem {
  id: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string } };
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

export const youtubeTrendSource: TrendSource = {
  platformId: "youtube",
  label: "YouTube (via your connection)",
  unavailableHint: "Connect YouTube in Connections to scan it.",
  async available() {
    return Boolean(await liveYoutubeAccount());
  },
  async scan(keyword) {
    const account = await liveYoutubeAccount();
    if (!account) return [];
    const db = await getDb();
    const payload = await freshOAuthPayload(
      contextFor(db, account),
      "google",
    );
    const auth = { Authorization: `Bearer ${payload.accessToken}` };

    const publishedAfter = new Date(
      Date.now() - 14 * 86_400_000,
    ).toISOString();
    const search = await liveFetch<{ items?: SearchItem[] }>(
      `${API}/search?` +
        new URLSearchParams({
          part: "snippet",
          q: keyword,
          type: "video",
          order: "viewCount",
          publishedAfter,
          maxResults: "15",
        }),
      { headers: auth },
    );
    const ids = (search.items ?? [])
      .map((i) => i.id?.videoId)
      .filter((v): v is string => Boolean(v));
    if (ids.length === 0) return [];

    const videos = await liveFetch<{ items?: VideoItem[] }>(
      `${API}/videos?` +
        new URLSearchParams({
          part: "snippet,statistics",
          id: ids.join(","),
        }),
      { headers: auth },
    );

    return (videos.items ?? [])
      .map((v): TrendSignal => {
        const views = Number(v.statistics?.viewCount ?? 0);
        return {
          platformId: "youtube",
          keyword,
          title: (v.snippet?.title ?? "Untitled").slice(0, 220),
          url: `https://www.youtube.com/watch?v=${v.id}`,
          author: v.snippet?.channelTitle ?? "unknown",
          postedAt: v.snippet?.publishedAt ?? new Date(0).toISOString(),
          mediaType: "video",
          thumb: v.snippet?.thumbnails?.medium?.url,
          engagement: {
            score: Number(v.statistics?.likeCount ?? 0) || Math.floor(views / 50),
            comments: Number(v.statistics?.commentCount ?? 0),
            views,
          },
          heat: 0,
          source: "live",
        };
      })
      .sort((a, b) => (b.engagement.views ?? 0) - (a.engagement.views ?? 0));
  },
};
