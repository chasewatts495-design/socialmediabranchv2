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
import { META_GRAPH_VERSION } from "@/lib/oauth/providers/meta";
import { liveFetch } from "./http";
import {
  type OAuthTokenPayload,
  isPublicUrl,
  publishFailure,
} from "./base";

/**
 * Instagram professional accounts via the Graph API (two-step container
 * publish: create → poll status → publish). Media must be publicly
 * hosted — Vercel Blob URLs qualify; local-disk dev uploads don't.
 */

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MetaPayload extends OAuthTokenPayload {
  igUserId?: string;
  pageToken?: string;
}

async function igAuth(ctx: ConnectorContext): Promise<{
  igUserId: string;
  pageToken: string;
}> {
  const payload = await ctx.getCredentials<MetaPayload>();
  if (!payload?.igUserId || !payload.pageToken) {
    throw new Error("Instagram tokens missing — reconnect from the wizard.");
  }
  return { igUserId: payload.igUserId, pageToken: payload.pageToken };
}

export class InstagramLiveConnector implements Connector {
  readonly capabilities: ConnectorCapabilities;

  constructor(private def: PlatformDefinition) {
    this.capabilities = def.capabilities;
  }

  async testConnection(ctx: ConnectorContext) {
    try {
      const { igUserId, pageToken } = await igAuth(ctx);
      const me = await liveFetch<{
        username?: string;
        followers_count?: number;
      }>(
        `${GRAPH}/${igUserId}?fields=username,followers_count&access_token=${encodeURIComponent(pageToken)}`,
      );
      return {
        ok: true,
        message: `Connected as @${me.username} (${me.followers_count ?? 0} followers) — live.`,
        profile: { handle: `@${me.username}` },
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
    const { igUserId, pageToken } = await igAuth(ctx);
    const endDate = new Date().toISOString().slice(0, 10);
    const byDate = new Map<string, NormalizedAccountStats>();

    try {
      const since = Math.floor(
        new Date(`${opts.sinceDate}T00:00:00Z`).getTime() / 1000,
      );
      const until = Math.floor(Date.now() / 1000);
      const insights = await liveFetch<{
        data?: {
          name: string;
          values?: { value?: number; end_time?: string }[];
        }[];
      }>(
        `${GRAPH}/${igUserId}/insights?` +
          new URLSearchParams({
            metric: "reach,profile_views",
            period: "day",
            since: String(since),
            until: String(until),
            access_token: pageToken,
          }),
      );
      for (const metric of insights.data ?? []) {
        for (const v of metric.values ?? []) {
          const date = v.end_time?.slice(0, 10);
          if (!date) continue;
          const row = byDate.get(date) ?? { date };
          if (metric.name === "reach") row.reach = v.value;
          if (metric.name === "profile_views") row.profileViews = v.value;
          byDate.set(date, row);
        }
      }
    } catch {
      // Insights window/metric availability varies by account age and
      // size — the follower snapshot still lands below.
    }

    const me = await liveFetch<{
      followers_count?: number;
      media_count?: number;
    }>(
      `${GRAPH}/${igUserId}?fields=followers_count,media_count&access_token=${encodeURIComponent(pageToken)}`,
    );
    const rows = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const latest = rows.at(-1);
    if (latest) {
      latest.followers = me.followers_count;
      latest.postCount = me.media_count;
    } else {
      rows.push({
        date: endDate,
        followers: me.followers_count,
        postCount: me.media_count,
      });
    }
    return rows;
  }

  async fetchRecentPosts(
    ctx: ConnectorContext,
    opts: { limit: number },
  ): Promise<NormalizedPost[]> {
    const { igUserId, pageToken } = await igAuth(ctx);
    const res = await liveFetch<{
      data?: {
        id: string;
        caption?: string;
        permalink?: string;
        timestamp?: string;
        media_type?: string;
        like_count?: number;
        comments_count?: number;
      }[];
    }>(
      `${GRAPH}/${igUserId}/media?` +
        new URLSearchParams({
          fields:
            "id,caption,permalink,timestamp,media_type,like_count,comments_count",
          limit: String(Math.min(opts.limit, 25)),
          access_token: pageToken,
        }),
    );
    return (res.data ?? []).map((m) => ({
      externalId: m.id,
      url: m.permalink,
      caption: m.caption ?? "",
      mediaKind:
        m.media_type === "VIDEO" || m.media_type === "REELS"
          ? ("video" as const)
          : m.media_type === "CAROUSEL_ALBUM"
            ? ("carousel" as const)
            : ("image" as const),
      publishedAt: m.timestamp ?? new Date().toISOString(),
      metrics: {
        likes: m.like_count,
        comments: m.comments_count,
      },
    }));
  }

  async publishPost(
    ctx: ConnectorContext,
    payload: PublishPayload,
  ): Promise<PublishResult> {
    const validation = this.validateContent(payload);
    if (!validation.valid) {
      return {
        ok: false,
        errorCode: validation.issues[0]?.code ?? "INVALID",
        errorMessage:
          validation.issues[0]?.message ?? "Post fails Instagram's rules.",
        retryable: false,
      };
    }
    const media = payload.media[0];
    if (!media) {
      return {
        ok: false,
        errorCode: "MEDIA_REQUIRED",
        errorMessage: "Instagram needs an image or video.",
        retryable: false,
      };
    }
    if (!isPublicUrl(media.url)) {
      return {
        ok: false,
        errorCode: "PUBLIC_URL_REQUIRED",
        errorMessage:
          "Instagram fetches media from a public URL — this file isn't publicly hosted yet (deploys with Vercel Blob are).",
        retryable: false,
      };
    }
    try {
      const { igUserId, pageToken } = await igAuth(ctx);
      const isVideo = media.mimeType.startsWith("video/");
      const container = await liveFetch<{ id?: string }>(
        `${GRAPH}/${igUserId}/media`,
        {
          method: "POST",
          form: {
            ...(isVideo
              ? { media_type: "REELS", video_url: media.url }
              : { image_url: media.url }),
            caption: payload.caption,
            access_token: pageToken,
          },
        },
      );
      if (!container.id) {
        return {
          ok: false,
          errorCode: "NO_CONTAINER",
          errorMessage: "Instagram didn't accept the media container.",
          retryable: true,
        };
      }

      // Poll until Instagram finishes ingesting (videos take a while).
      const deadline = Date.now() + (isVideo ? 90_000 : 30_000);
      let status = "IN_PROGRESS";
      while (Date.now() < deadline) {
        const check = await liveFetch<{ status_code?: string }>(
          `${GRAPH}/${container.id}?fields=status_code&access_token=${encodeURIComponent(pageToken)}`,
        );
        status = check.status_code ?? "IN_PROGRESS";
        if (status === "FINISHED") break;
        if (status === "ERROR") {
          return {
            ok: false,
            errorCode: "CONTAINER_ERROR",
            errorMessage:
              "Instagram couldn't process the media (format/size limits).",
            retryable: false,
          };
        }
        await sleep(2500);
      }
      if (status !== "FINISHED") {
        return {
          ok: false,
          errorCode: "STILL_PROCESSING",
          errorMessage:
            "Instagram is still processing the media — retrying shortly usually completes it.",
          retryable: true,
        };
      }

      const published = await liveFetch<{ id?: string }>(
        `${GRAPH}/${igUserId}/media_publish`,
        {
          method: "POST",
          form: { creation_id: container.id, access_token: pageToken },
        },
      );
      if (!published.id) {
        return {
          ok: false,
          errorCode: "NO_MEDIA_ID",
          errorMessage: "Instagram published nothing — try again.",
          retryable: true,
        };
      }
      let permalink: string | undefined;
      try {
        const meta = await liveFetch<{ permalink?: string }>(
          `${GRAPH}/${published.id}?fields=permalink&access_token=${encodeURIComponent(pageToken)}`,
        );
        permalink = meta.permalink;
      } catch {
        // permalink is cosmetic — the publish already succeeded
      }
      await ctx.log("instagram.posted", { id: published.id });
      return { ok: true, externalPostId: published.id, url: permalink };
    } catch (err) {
      return publishFailure(err);
    }
  }

  validateContent(payload: PublishPayload): ValidationResult {
    return validateAgainstCapabilities(
      this.capabilities,
      payload,
      this.def.extraValidation,
    );
  }
}
