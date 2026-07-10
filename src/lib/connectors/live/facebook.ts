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
 * Facebook Pages via the Graph API. Publishing and insights run on the
 * Page token (non-expiring when derived from a long-lived user token).
 * Many classic Page metrics were deprecated late-2025 — only a minimal
 * verified set is requested, and missing metrics stay null rather than
 * fabricated.
 */

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface MetaPayload extends OAuthTokenPayload {
  pageId?: string;
  pageToken?: string;
}

async function pageAuth(ctx: ConnectorContext): Promise<{
  pageId: string;
  pageToken: string;
}> {
  const payload = await ctx.getCredentials<MetaPayload>();
  if (!payload?.pageId || !payload.pageToken) {
    throw new Error("Facebook Page tokens missing — reconnect from the wizard.");
  }
  return { pageId: payload.pageId, pageToken: payload.pageToken };
}

export class FacebookLiveConnector implements Connector {
  readonly capabilities: ConnectorCapabilities;

  constructor(private def: PlatformDefinition) {
    this.capabilities = def.capabilities;
  }

  async testConnection(ctx: ConnectorContext) {
    try {
      const { pageId, pageToken } = await pageAuth(ctx);
      const page = await liveFetch<{
        name?: string;
        followers_count?: number;
      }>(
        `${GRAPH}/${pageId}?fields=name,followers_count&access_token=${encodeURIComponent(pageToken)}`,
      );
      return {
        ok: true,
        message: `Connected to ${page.name} (${page.followers_count ?? 0} followers) — live.`,
        profile: { handle: page.name ?? "Page" },
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
    const { pageId, pageToken } = await pageAuth(ctx);
    const endDate = new Date().toISOString().slice(0, 10);
    const byDate = new Map<string, NormalizedAccountStats>();

    try {
      const insights = await liveFetch<{
        data?: {
          name: string;
          values?: { value?: number; end_time?: string }[];
        }[];
      }>(
        `${GRAPH}/${pageId}/insights?` +
          new URLSearchParams({
            metric: "page_impressions_unique,page_post_engagements",
            period: "day",
            since: opts.sinceDate,
            until: endDate,
            access_token: pageToken,
          }),
      );
      for (const metric of insights.data ?? []) {
        for (const v of metric.values ?? []) {
          const date = v.end_time?.slice(0, 10);
          if (!date) continue;
          const row = byDate.get(date) ?? { date };
          if (metric.name === "page_impressions_unique") row.reach = v.value;
          if (metric.name === "page_post_engagements") row.engagements = v.value;
          byDate.set(date, row);
        }
      }
    } catch {
      // Insights need pages_read_engagement + recent activity; the
      // follower snapshot below still gives the dashboard something real.
    }

    const page = await liveFetch<{ followers_count?: number }>(
      `${GRAPH}/${pageId}?fields=followers_count&access_token=${encodeURIComponent(pageToken)}`,
    );
    const rows = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    if (rows.length > 0) rows[rows.length - 1].followers = page.followers_count;
    else rows.push({ date: endDate, followers: page.followers_count });
    return rows;
  }

  async fetchRecentPosts(
    ctx: ConnectorContext,
    opts: { limit: number },
  ): Promise<NormalizedPost[]> {
    const { pageId, pageToken } = await pageAuth(ctx);
    const res = await liveFetch<{
      data?: {
        id: string;
        message?: string;
        created_time?: string;
        permalink_url?: string;
        shares?: { count?: number };
        likes?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
      }[];
    }>(
      `${GRAPH}/${pageId}/posts?` +
        new URLSearchParams({
          fields:
            "id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true)",
          limit: String(Math.min(opts.limit, 25)),
          access_token: pageToken,
        }),
    );
    return (res.data ?? []).map((p) => ({
      externalId: p.id,
      url: p.permalink_url,
      caption: p.message ?? "",
      mediaKind: "text" as const,
      publishedAt: p.created_time ?? new Date().toISOString(),
      metrics: {
        likes: p.likes?.summary?.total_count,
        comments: p.comments?.summary?.total_count,
        shares: p.shares?.count,
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
        errorMessage: validation.issues[0]?.message ?? "Post fails Facebook's rules.",
        retryable: false,
      };
    }
    try {
      const { pageId, pageToken } = await pageAuth(ctx);
      const image = payload.media.find(
        (m) => m.mimeType.startsWith("image/") && isPublicUrl(m.url),
      );
      const res: { id?: string; post_id?: string } = image
        ? await liveFetch<{ id?: string; post_id?: string }>(
            `${GRAPH}/${pageId}/photos`,
            {
              method: "POST",
              form: {
                url: image.url,
                caption: payload.caption,
                access_token: pageToken,
              },
            },
          )
        : await liveFetch<{ id?: string }>(`${GRAPH}/${pageId}/feed`, {
            method: "POST",
            form: { message: payload.caption, access_token: pageToken },
          });
      const id = res.post_id ?? res.id;
      if (!id) {
        return {
          ok: false,
          errorCode: "NO_POST_ID",
          errorMessage: "Facebook accepted the post but returned no id.",
          retryable: true,
        };
      }
      await ctx.log("facebook.posted", { id });
      return {
        ok: true,
        externalPostId: id,
        url: `https://www.facebook.com/${id}`,
      };
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
