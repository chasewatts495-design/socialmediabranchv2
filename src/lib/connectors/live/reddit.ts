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
import { isPublicUrl, publishFailure } from "./base";

/**
 * Reddit script-app connector — the platform-sanctioned password grant
 * for your OWN account: the password is sent only to reddit.com's token
 * endpoint and never stored; Branch keeps just the app credentials the
 * owner created at reddit.com/prefs/apps.
 */

interface RedditCreds {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

interface RedditListingChild {
  data: {
    name: string; // t3_xxx
    title?: string;
    selftext?: string;
    permalink?: string;
    score?: number;
    num_comments?: number;
    upvote_ratio?: number;
    created_utc?: number;
    is_video?: boolean;
    post_hint?: string;
  };
}

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API = "https://oauth.reddit.com";

function userAgent(username: string): string {
  return `web:branch-command-center:v2.0 (by /u/${username})`;
}

export class RedditLiveConnector implements Connector {
  readonly capabilities: ConnectorCapabilities;
  /** Tokens live 60 minutes; cache one per connector instance. */
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private def: PlatformDefinition) {
    this.capabilities = def.capabilities;
  }

  private async creds(ctx: ConnectorContext): Promise<RedditCreds> {
    const c = await ctx.getCredentials<RedditCreds>();
    if (!c?.clientId || !c.clientSecret || !c.username || !c.password) {
      throw new Error(
        "Reddit credentials incomplete — fill in all four fields in the wizard.",
      );
    }
    return c;
  }

  private async accessToken(ctx: ConnectorContext): Promise<{
    token: string;
    username: string;
  }> {
    const c = await this.creds(ctx);
    if (this.token && this.token.expiresAt - Date.now() > 60_000) {
      return { token: this.token.value, username: c.username };
    }
    const res = await liveFetch<{
      access_token?: string;
      expires_in?: number;
      error?: string;
    }>(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
        "User-Agent": userAgent(c.username),
      },
      form: {
        grant_type: "password",
        username: c.username,
        password: c.password,
      },
    });
    if (!res.access_token) {
      throw new Error(
        `Reddit rejected the login (${res.error ?? "unknown error"}) — check the app type is 'script' and the username/password are right.`,
      );
    }
    this.token = {
      value: res.access_token,
      expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000,
    };
    return { token: res.access_token, username: c.username };
  }

  private async api<T>(ctx: ConnectorContext, path: string, init?: {
    method?: "GET" | "POST";
    form?: Record<string, string>;
  }): Promise<T> {
    const { token, username } = await this.accessToken(ctx);
    return liveFetch<T>(`${API}${path}`, {
      method: init?.method,
      form: init?.form,
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent(username),
      },
    });
  }

  async testConnection(ctx: ConnectorContext) {
    try {
      const me = await this.api<{
        name?: string;
        total_karma?: number;
      }>(ctx, "/api/v1/me");
      if (!me.name) return { ok: false, message: "Reddit returned no profile." };
      return {
        ok: true,
        message: `Connected as u/${me.name} (${me.total_karma ?? 0} karma) — live.`,
        profile: { handle: `u/${me.name}`, displayName: me.name },
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Connection failed.",
      };
    }
  }

  // Reddit exposes no account-level history (capabilities say so); the
  // registry never routes stats syncs here, but the contract needs a body.
  async fetchAccountStats(): Promise<NormalizedAccountStats[]> {
    return [];
  }

  async fetchRecentPosts(
    ctx: ConnectorContext,
    opts: { limit: number },
  ): Promise<NormalizedPost[]> {
    const c = await this.creds(ctx);
    const listing = await this.api<{
      data?: { children?: RedditListingChild[] };
    }>(
      ctx,
      `/user/${encodeURIComponent(c.username)}/submitted?limit=${Math.min(opts.limit, 100)}&raw_json=1`,
    );
    return (listing.data?.children ?? []).map(({ data }) => ({
      externalId: data.name,
      url: data.permalink ? `https://www.reddit.com${data.permalink}` : undefined,
      caption: data.title ?? data.selftext?.slice(0, 200) ?? "",
      mediaKind: data.is_video
        ? ("video" as const)
        : data.post_hint === "image"
          ? ("image" as const)
          : ("text" as const),
      publishedAt: new Date((data.created_utc ?? 0) * 1000).toISOString(),
      metrics: {
        likes: data.score,
        comments: data.num_comments,
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
        errorMessage: validation.issues[0]?.message ?? "Post fails Reddit's rules.",
        retryable: false,
      };
    }
    try {
      const subreddit = String(payload.meta.subreddit ?? "")
        .trim()
        .replace(/^r\//i, "");
      const title =
        (typeof payload.meta.title === "string" && payload.meta.title.trim()) ||
        payload.caption.slice(0, 300) ||
        "Untitled";

      const firstMedia = payload.media[0];
      const asLink = firstMedia && isPublicUrl(firstMedia.url);
      const form: Record<string, string> = {
        api_type: "json",
        sr: subreddit,
        title,
        kind: asLink ? "link" : "self",
        ...(asLink ? { url: firstMedia.url } : { text: payload.caption }),
      };

      const res = await this.api<{
        json?: {
          errors?: [string, string, string?][];
          data?: { name?: string; url?: string; id?: string };
        };
      }>(ctx, "/api/submit", { method: "POST", form });

      const errors = res.json?.errors ?? [];
      if (errors.length > 0) {
        const [code, detail] = errors[0];
        return {
          ok: false,
          errorCode: code,
          errorMessage: `Reddit said: ${detail ?? code}`,
          // Rate limits ("you're doing that too much") are worth retrying.
          retryable: code === "RATELIMIT",
        };
      }
      const name = res.json?.data?.name ?? res.json?.data?.id ?? "";
      await ctx.log("reddit.posted", { subreddit, name });
      return {
        ok: true,
        externalPostId: name || `r/${subreddit}`,
        url: res.json?.data?.url,
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
