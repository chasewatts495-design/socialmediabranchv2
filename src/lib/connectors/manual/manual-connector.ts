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

/**
 * For platforms without a usable API (Snapchat) or accounts the owner opts
 * out of automating. Publishing produces a manual checklist item (handled by
 * the publish pipeline — this connector never "posts"); stats arrive via the
 * manual entry form or CSV import.
 */
export class ManualConnector implements Connector {
  readonly capabilities: ConnectorCapabilities;

  constructor(private def: PlatformDefinition) {
    // Manual accounts can never auto-publish, whatever the platform allows.
    this.capabilities = {
      ...def.capabilities,
      canPublish: false,
      canFetchAccountStats: false,
      canFetchPostStats: false,
    };
  }

  async testConnection(ctx: ConnectorContext) {
    return {
      ok: true,
      message: "Manual mode — you post in the app yourself and record stats here.",
      profile: { handle: ctx.account.handle },
    };
  }

  async fetchAccountStats(): Promise<NormalizedAccountStats[]> {
    return []; // stats come from manual entry / CSV, already in the database
  }

  async fetchRecentPosts(): Promise<NormalizedPost[]> {
    return [];
  }

  async publishPost(
    _ctx: ConnectorContext,
    _payload: PublishPayload,
  ): Promise<PublishResult> {
    return {
      ok: false,
      errorCode: "MANUAL_ONLY",
      errorMessage:
        "This account is manual — Branch creates a checklist item instead of auto-posting.",
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
