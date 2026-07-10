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
import { daysAgo, postMetricsFor, statsRange, dayRand } from "./generators";
import { DEMO_EXTERNAL_URL, demoKey, profileFor } from "./profiles";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface DemoConnectorOptions {
  simulateFailures?: boolean;
}

/**
 * Fully-working stand-in for a real platform API. Uses the platform's REAL
 * constraints for validation, and deterministic generators for data — so the
 * whole app behaves exactly as it will once live credentials are added.
 */
export class DemoConnector implements Connector {
  readonly capabilities: ConnectorCapabilities;

  constructor(
    private def: PlatformDefinition,
    private opts: DemoConnectorOptions = {},
  ) {
    this.capabilities = def.capabilities;
  }

  async testConnection(ctx: ConnectorContext) {
    return {
      ok: true,
      message: "Demo mode — data is simulated until real credentials are added.",
      profile: { handle: ctx.account.handle },
    };
  }

  async fetchAccountStats(
    ctx: ConnectorContext,
    opts: { sinceDate: string },
  ): Promise<NormalizedAccountStats[]> {
    const key = demoKey(ctx.account.platformId, ctx.account.handle);
    const profile = profileFor(ctx.account.platformId, ctx.account.handle);
    return statsRange(key, profile, opts.sinceDate);
  }

  async fetchRecentPosts(
    ctx: ConnectorContext,
    opts: { limit: number },
  ): Promise<NormalizedPost[]> {
    const key = demoKey(ctx.account.platformId, ctx.account.handle);
    const profile = profileFor(ctx.account.platformId, ctx.account.handle);
    const posts: NormalizedPost[] = [];
    for (let i = 0; i < opts.limit; i++) {
      const isoDate = daysAgo(i * 3 + 1);
      const externalId = `recent-${key}-${i}`;
      posts.push({
        externalId,
        url: DEMO_EXTERNAL_URL[ctx.account.platformId](externalId),
        caption: `Demo post from ${isoDate}`,
        mediaKind: profile.video ? "video" : "image",
        publishedAt: `${isoDate}T12:00:00Z`,
        metrics: postMetricsFor(key, profile, isoDate, i),
      });
    }
    return posts;
  }

  async publishPost(
    ctx: ConnectorContext,
    payload: PublishPayload,
  ): Promise<PublishResult> {
    const validation = this.validateContent(payload);
    if (!validation.valid) {
      return {
        ok: false,
        errorCode: "VALIDATION_FAILED",
        errorMessage: validation.issues
          .filter((i) => i.level === "error")
          .map((i) => i.message)
          .join(" "),
        retryable: false,
      };
    }

    await sleep(400 + Math.random() * 800); // feel like a real network call

    if (this.opts.simulateFailures && Math.random() < 1 / 6) {
      return {
        ok: false,
        errorCode: "DEMO_TRANSIENT_ERROR",
        errorMessage:
          "Simulated transient platform error (demo mode, 'simulate failures' is on). Retry will succeed.",
        retryable: true,
      };
    }

    const rand = dayRand(ctx.account.id, new Date().toISOString());
    const externalPostId = `demo-${Math.floor(rand() * 1e9).toString(36)}${Date.now().toString(36)}`;
    await ctx.log("demo.published", { externalPostId });
    return {
      ok: true,
      externalPostId,
      url: DEMO_EXTERNAL_URL[ctx.account.platformId](externalPostId),
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
