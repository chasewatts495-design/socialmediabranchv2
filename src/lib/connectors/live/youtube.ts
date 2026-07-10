import type {
  Connector,
  ConnectorCapabilities,
  ConnectorContext,
  NormalizedAccountStats,
  NormalizedPost,
  PublishPayload,
  PublishResult,
  ValidationResult,
} from "../types";
import type { PlatformDefinition } from "../platforms/def";
import { validateAgainstCapabilities } from "../validate";
import { liveFetch } from "./http";
import { freshOAuthPayload } from "./base";

/**
 * YouTube, analytics-first: channel stats + daily Analytics API series +
 * per-video stats. Uploading through the API is deliberately not enabled
 * yet — unaudited API uploads are forced private by Google and burn 1600
 * of the 10k daily quota units, so the connector reports that honestly
 * instead of half-working.
 */

const DATA = "https://www.googleapis.com/youtube/v3";
const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports";

export class YouTubeLiveConnector implements Connector {
  readonly capabilities: ConnectorCapabilities;

  constructor(private def: PlatformDefinition) {
    this.capabilities = def.capabilities;
  }

  private async bearer(ctx: ConnectorContext): Promise<string> {
    const payload = await freshOAuthPayload(ctx, "google");
    return `Bearer ${payload.accessToken}`;
  }

  async testConnection(ctx: ConnectorContext) {
    try {
      const res = await liveFetch<{
        items?: {
          snippet?: { title?: string };
          statistics?: { subscriberCount?: string };
        }[];
      }>(`${DATA}/channels?part=snippet,statistics&mine=true`, {
        headers: { Authorization: await this.bearer(ctx) },
      });
      const ch = res.items?.[0];
      if (!ch) return { ok: false, message: "No channel on this Google account." };
      return {
        ok: true,
        message: `Connected to ${ch.snippet?.title} (${ch.statistics?.subscriberCount ?? "?"} subscribers) — live.`,
        profile: { handle: ch.snippet?.title ?? "channel" },
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Connection failed.",
      };
    }
  }

  async fetchAccountStats(
    ctx: ConnectorContext,
    opts: { sinceDate: string },
  ): Promise<NormalizedAccountStats[]> {
    const auth = await this.bearer(ctx);
    const endDate = new Date().toISOString().slice(0, 10);
    const report = await liveFetch<{
      rows?: (string | number)[][];
    }>(
      `${ANALYTICS}?` +
        new URLSearchParams({
          ids: "channel==MINE",
          startDate: opts.sinceDate,
          endDate,
          metrics:
            "views,estimatedMinutesWatched,likes,comments,shares,subscribersGained",
          dimensions: "day",
          sort: "day",
        }),
      { headers: { Authorization: auth } },
    );
    const channel = await liveFetch<{
      items?: { statistics?: { subscriberCount?: string; videoCount?: string } }[];
    }>(`${DATA}/channels?part=statistics&mine=true`, {
      headers: { Authorization: auth },
    });
    const stats = channel.items?.[0]?.statistics;

    const rows: NormalizedAccountStats[] = (report.rows ?? []).map((r) => ({
      date: String(r[0]),
      videoViews: Number(r[1]) || 0,
      watchTimeSec: Math.round((Number(r[2]) || 0) * 60),
      likes: Number(r[3]) || 0,
      comments: Number(r[4]) || 0,
      shares: Number(r[5]) || 0,
      engagements:
        (Number(r[3]) || 0) + (Number(r[4]) || 0) + (Number(r[5]) || 0),
      impressions: Number(r[1]) || 0,
    }));
    const latest = rows.at(-1) ?? { date: endDate };
    latest.followers = stats?.subscriberCount
      ? Number(stats.subscriberCount)
      : undefined;
    latest.postCount = stats?.videoCount ? Number(stats.videoCount) : undefined;
    if (rows.length === 0) rows.push(latest);
    return rows;
  }

  async fetchRecentPosts(
    ctx: ConnectorContext,
    opts: { limit: number },
  ): Promise<NormalizedPost[]> {
    const auth = await this.bearer(ctx);
    const channel = await liveFetch<{
      items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
    }>(`${DATA}/channels?part=contentDetails&mine=true`, {
      headers: { Authorization: auth },
    });
    const uploads =
      channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return [];

    const playlist = await liveFetch<{
      items?: {
        snippet?: { title?: string; publishedAt?: string };
        contentDetails?: { videoId?: string };
      }[];
    }>(
      `${DATA}/playlistItems?part=snippet,contentDetails&playlistId=${uploads}&maxResults=${Math.min(opts.limit, 20)}`,
      { headers: { Authorization: auth } },
    );
    const ids = (playlist.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((v): v is string => Boolean(v));
    if (ids.length === 0) return [];

    const videos = await liveFetch<{
      items?: {
        id: string;
        snippet?: { title?: string; publishedAt?: string };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
      }[];
    }>(`${DATA}/videos?part=snippet,statistics&id=${ids.join(",")}`, {
      headers: { Authorization: auth },
    });

    return (videos.items ?? []).map((v) => ({
      externalId: v.id,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      caption: v.snippet?.title ?? "",
      mediaKind: "video" as const,
      publishedAt: v.snippet?.publishedAt ?? new Date().toISOString(),
      metrics: {
        videoViews: v.statistics?.viewCount
          ? Number(v.statistics.viewCount)
          : undefined,
        likes: v.statistics?.likeCount
          ? Number(v.statistics.likeCount)
          : undefined,
        comments: v.statistics?.commentCount
          ? Number(v.statistics.commentCount)
          : undefined,
      },
    }));
  }

  async publishPost(
    ctx: ConnectorContext,
    _payload: PublishPayload,
  ): Promise<PublishResult> {
    await ctx.log("youtube.publish_unavailable");
    return {
      ok: false,
      errorCode: "UPLOAD_VIA_STUDIO",
      errorMessage:
        "YouTube API uploads stay private until Google audits the app, so Branch doesn't enable them yet. Upload from YouTube Studio — the video and its stats sync here automatically.",
      retryable: false,
    };
  }

  validateContent(payload: PublishPayload): ValidationResult {
    return validateAgainstCapabilities(
      this.capabilities,
      payload,
      this.def.extraValidation,
    );
  }
}
