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
import { freshOAuthPayload, isPublicUrl, publishFailure } from "./base";

/** Pinterest API v5 — analytics, pins, and pin creation. */

const API = "https://api.pinterest.com/v5";

interface DailyMetrics {
  date: string;
  metrics?: Record<string, number>;
}

export class PinterestLiveConnector implements Connector {
  readonly capabilities: ConnectorCapabilities;

  constructor(private def: PlatformDefinition) {
    this.capabilities = def.capabilities;
  }

  private async bearer(ctx: ConnectorContext): Promise<string> {
    const payload = await freshOAuthPayload(ctx, "pinterest");
    return `Bearer ${payload.accessToken}`;
  }

  async testConnection(ctx: ConnectorContext) {
    try {
      const me = await liveFetch<{
        username?: string;
        follower_count?: number;
      }>(`${API}/user_account`, {
        headers: { Authorization: await this.bearer(ctx) },
      });
      if (!me.username) {
        return { ok: false, message: "Pinterest returned no profile." };
      }
      return {
        ok: true,
        message: `Connected as @${me.username} (${me.follower_count ?? 0} followers) — live.`,
        profile: { handle: `@${me.username}`, displayName: me.username },
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
    const analytics = await liveFetch<{
      all?: { daily_metrics?: DailyMetrics[] };
    }>(
      `${API}/user_account/analytics?` +
        new URLSearchParams({
          start_date: opts.sinceDate,
          end_date: endDate,
          metric_types: "IMPRESSION,ENGAGEMENT,SAVE,PIN_CLICK",
        }),
      { headers: { Authorization: auth } },
    );
    const me = await liveFetch<{ follower_count?: number }>(
      `${API}/user_account`,
      { headers: { Authorization: auth } },
    );

    const rows: NormalizedAccountStats[] = (
      analytics.all?.daily_metrics ?? []
    ).map((d) => ({
      date: d.date,
      impressions: d.metrics?.IMPRESSION,
      engagements: d.metrics?.ENGAGEMENT,
      saves: d.metrics?.SAVE,
    }));
    // Follower count is a snapshot — pin it to the latest day.
    if (rows.length > 0) {
      rows[rows.length - 1].followers = me.follower_count;
    } else {
      rows.push({ date: endDate, followers: me.follower_count });
    }
    return rows;
  }

  async fetchRecentPosts(
    ctx: ConnectorContext,
    opts: { limit: number },
  ): Promise<NormalizedPost[]> {
    const auth = await this.bearer(ctx);
    const list = await liveFetch<{
      items?: {
        id: string;
        title?: string;
        description?: string;
        created_at?: string;
        link?: string;
      }[];
    }>(`${API}/pins?page_size=${Math.min(opts.limit, 25)}`, {
      headers: { Authorization: auth },
    });

    const since = new Date(Date.now() - 90 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    return Promise.all(
      (list.items ?? []).map(async (pin) => {
        let metrics: NormalizedPost["metrics"] = {};
        try {
          const a = await liveFetch<{
            all?: { summary_metrics?: Record<string, number> };
          }>(
            `${API}/pins/${pin.id}/analytics?` +
              new URLSearchParams({
                start_date: since,
                end_date: today,
                metric_types: "IMPRESSION,SAVE,PIN_CLICK",
              }),
            { headers: { Authorization: auth } },
          );
          const m = a.all?.summary_metrics ?? {};
          metrics = { impressions: m.IMPRESSION, saves: m.SAVE };
        } catch {
          // Per-pin analytics can 403 on fresh pins — the pin still counts.
        }
        return {
          externalId: pin.id,
          url: `https://www.pinterest.com/pin/${pin.id}/`,
          caption: pin.title ?? pin.description ?? "",
          mediaKind: "image" as const,
          publishedAt: pin.created_at ?? new Date().toISOString(),
          metrics,
        };
      }),
    );
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
          validation.issues[0]?.message ?? "Pin fails Pinterest's rules.",
        retryable: false,
      };
    }
    const image = payload.media.find((m) => m.mimeType.startsWith("image/"));
    if (!image) {
      return {
        ok: false,
        errorCode: "IMAGE_REQUIRED",
        errorMessage: "Pinterest needs an image.",
        retryable: false,
      };
    }
    if (!isPublicUrl(image.url)) {
      return {
        ok: false,
        errorCode: "PUBLIC_URL_REQUIRED",
        errorMessage:
          "Pinterest fetches the image from a public URL — this media isn't publicly hosted yet (deploys with Vercel Blob are).",
        retryable: false,
      };
    }
    const boardId = String(payload.meta.boardId ?? "").trim();
    if (!boardId) {
      return {
        ok: false,
        errorCode: "BOARD_REQUIRED",
        errorMessage:
          "Pinterest needs a Board ID — set it in the composer's Fine-tune step (it's the number in the board's URL).",
        retryable: false,
      };
    }
    try {
      const pin = await liveFetch<{ id?: string }>(`${API}/pins`, {
        method: "POST",
        headers: { Authorization: await this.bearer(ctx) },
        json: {
          board_id: boardId,
          title:
            (typeof payload.meta.title === "string" &&
              payload.meta.title.slice(0, 100)) ||
            payload.caption.slice(0, 100),
          description: payload.caption.slice(0, 800),
          media_source: { source_type: "image_url", url: image.url },
        },
      });
      if (!pin.id) {
        return {
          ok: false,
          errorCode: "NO_PIN_ID",
          errorMessage: "Pinterest accepted the request but returned no pin id.",
          retryable: true,
        };
      }
      await ctx.log("pinterest.pinned", { pinId: pin.id, boardId });
      return {
        ok: true,
        externalPostId: pin.id,
        url: `https://www.pinterest.com/pin/${pin.id}/`,
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
