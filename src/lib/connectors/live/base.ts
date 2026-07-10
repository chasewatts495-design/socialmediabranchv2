import type { ConnectorContext, PublishResult } from "../types";
import { providerFor } from "@/lib/oauth";
import { getOAuthAppCreds } from "@/lib/oauth/app-credentials";
import { LiveHttpError } from "./http";

/** Shape of the encrypted payload written by the OAuth callback. */
export interface OAuthTokenPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scopes?: string[];
  externalId?: string;
  [key: string]: unknown;
}

export class AuthExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthExpiredError";
  }
}

const REFRESH_SKEW_MS = 120_000;

/**
 * Loads the account's OAuth payload, transparently refreshing (and
 * persisting the rotated tokens) when the access token is near death.
 * The single place every OAuth-based live connector gets tokens from.
 */
export async function freshOAuthPayload(
  ctx: ConnectorContext,
  providerKey: string,
): Promise<OAuthTokenPayload> {
  const payload = await ctx.getCredentials<OAuthTokenPayload>();
  if (!payload?.accessToken) {
    throw new AuthExpiredError(
      "No connection tokens on file — hit Connect in the wizard.",
    );
  }
  const dying =
    typeof payload.expiresAt === "number" &&
    payload.expiresAt - Date.now() < REFRESH_SKEW_MS;
  if (!dying) return payload;

  const provider = providerFor(providerKey);
  if (!provider?.refresh || !payload.refreshToken) {
    throw new AuthExpiredError(
      "This connection expired — reconnect from the wizard.",
    );
  }
  const app = await getOAuthAppCreds(providerKey);
  if (!app) {
    throw new AuthExpiredError(
      "The developer-app keys were removed — add them back in the wizard.",
    );
  }
  const refreshed = await provider.refresh(
    {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: payload.expiresAt,
      scopes: payload.scopes ?? [],
    },
    app.creds,
  );
  const next: OAuthTokenPayload = { ...payload, ...refreshed };
  await ctx.saveCredentials?.(next, {
    expiresAt: refreshed.expiresAt ? new Date(refreshed.expiresAt) : null,
  });
  return next;
}

/** Maps a thrown error from a platform API into an honest PublishResult. */
export function publishFailure(err: unknown): PublishResult {
  if (err instanceof AuthExpiredError) {
    return {
      ok: false,
      errorCode: "AUTH_EXPIRED",
      errorMessage: err.message,
      retryable: false,
    };
  }
  if (err instanceof LiveHttpError) {
    if (err.status === 401 || err.status === 403) {
      return {
        ok: false,
        errorCode: "AUTH_EXPIRED",
        errorMessage:
          "The platform rejected Branch's access — reconnect from the wizard.",
        retryable: false,
      };
    }
    if (err.status === 429 || err.status >= 500) {
      return {
        ok: false,
        errorCode: err.status === 429 ? "RATE_LIMITED" : "PLATFORM_DOWN",
        errorMessage:
          err.status === 429
            ? "Rate limited by the platform — retry shortly."
            : "The platform had a hiccup — retry shortly.",
        retryable: true,
      };
    }
    return {
      ok: false,
      errorCode: `HTTP_${err.status}`,
      errorMessage: err.message,
      retryable: false,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  // Network-level failures (fetch TypeError) are worth retrying.
  return {
    ok: false,
    errorCode: "NETWORK",
    errorMessage: message,
    retryable: true,
  };
}

/** True when a media URL is publicly fetchable by a platform's servers. */
export function isPublicUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1/.test(url);
}
