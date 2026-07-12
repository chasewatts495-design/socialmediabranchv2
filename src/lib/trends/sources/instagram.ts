import { getDb } from "@/lib/db/client";
import { contextFor } from "@/lib/scheduler/jobs";
import { liveFetch } from "@/lib/connectors/live/http";
import { META_GRAPH_VERSION } from "@/lib/oauth/providers/meta";
import type { TrendSignal, TrendSource } from "../types";

/**
 * Instagram hashtag scan through the owner's connected IG professional
 * account: ig_hashtag_search → top_media. Keywords are collapsed to a
 * single hashtag token (Meta only searches exact hashtags).
 */

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface IgPayload {
  igUserId?: string;
  pageToken?: string;
  [key: string]: unknown;
}

async function liveInstagramCreds(): Promise<IgPayload | null> {
  const db = await getDb();
  const account = await db.query.accounts.findFirst({
    where: (a, { and: and2, eq: eq2 }) =>
      and2(eq2(a.platformId, "instagram"), eq2(a.mode, "live")),
  });
  if (!account) return null;
  const payload = await contextFor(db, account).getCredentials<IgPayload>();
  return payload?.igUserId && payload.pageToken ? payload : null;
}

function hashtagToken(keyword: string): string {
  return keyword.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
}

export const instagramTrendSource: TrendSource = {
  platformId: "instagram",
  label: "Instagram (hashtag top posts)",
  unavailableHint: "Connect Instagram in Connections to scan hashtags.",
  async available() {
    return Boolean(await liveInstagramCreds());
  },
  async scan(keyword) {
    const creds = await liveInstagramCreds();
    if (!creds) return [];
    const tag = hashtagToken(keyword);
    if (!tag) return [];

    const found = await liveFetch<{ data?: { id: string }[] }>(
      `${GRAPH}/ig_hashtag_search?` +
        new URLSearchParams({
          user_id: creds.igUserId!,
          q: tag,
          access_token: creds.pageToken!,
        }),
    );
    const hashtagId = found.data?.[0]?.id;
    if (!hashtagId) return [];

    const media = await liveFetch<{ data?: IgMedia[] }>(
      `${GRAPH}/${hashtagId}/top_media?` +
        new URLSearchParams({
          user_id: creds.igUserId!,
          fields: "id,caption,media_type,permalink,like_count,comments_count,timestamp",
          limit: "20",
          access_token: creds.pageToken!,
        }),
    );

    return (media.data ?? [])
      .filter((m) => m.permalink)
      .map((m): TrendSignal => {
        const likes = m.like_count ?? 0;
        const comments = m.comments_count ?? 0;
        return {
          platformId: "instagram",
          keyword,
          title: (m.caption ?? "(no caption)").slice(0, 220),
          url: m.permalink!,
          author: `#${tag}`,
          postedAt: m.timestamp ?? new Date(0).toISOString(),
          mediaType: m.media_type === "VIDEO" ? "video" : "image",
          engagement: { score: likes + comments * 2, comments },
          heat: 0,
          source: "live",
        };
      })
      .sort((a, b) => b.engagement.score - a.engagement.score);
  },
};
