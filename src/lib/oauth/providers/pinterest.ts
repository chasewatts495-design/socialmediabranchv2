import type { OAuthProvider, TokenSet } from "../types";
import { basicAuth, expiresAtFrom, getJson, postForm } from "./http";

/**
 * Pinterest API v5. Trial access works with the owner's own account the
 * moment the app is created. Continuous-refresh model: access token ~30
 * days, refresh token must be rotated (a NEW refresh token arrives on
 * every refresh and must be persisted).
 */

export const PINTEREST_SCOPES = [
  "user_accounts:read",
  "boards:read",
  "pins:read",
  "pins:write",
];

interface PinterestTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

function toTokenSet(r: PinterestTokenResponse, fallbackRefresh?: string): TokenSet {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? fallbackRefresh,
    expiresAt: expiresAtFrom(r.expires_in),
    tokenType: r.token_type,
    scopes: r.scope ? r.scope.split(/[ ,]+/) : PINTEREST_SCOPES,
  };
}

export const pinterestProvider: OAuthProvider = {
  key: "pinterest",
  displayName: "Pinterest",
  platformIds: ["pinterest"],

  authorizeUrl({ creds, redirectUri, state }) {
    const q = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: PINTEREST_SCOPES.join(","),
      state,
    });
    return `https://www.pinterest.com/oauth/?${q}`;
  },

  async exchangeCode({ code, redirectUri, creds }) {
    const r = await postForm<PinterestTokenResponse>(
      "https://api.pinterest.com/v5/oauth/token",
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      },
      { Authorization: basicAuth(creds.clientId, creds.clientSecret) },
    );
    return toTokenSet(r);
  },

  async refresh(tokenSet, creds) {
    if (!tokenSet.refreshToken) throw new Error("No Pinterest refresh token");
    const r = await postForm<PinterestTokenResponse>(
      "https://api.pinterest.com/v5/oauth/token",
      {
        grant_type: "refresh_token",
        refresh_token: tokenSet.refreshToken,
      },
      { Authorization: basicAuth(creds.clientId, creds.clientSecret) },
    );
    return toTokenSet(r, tokenSet.refreshToken);
  },

  async discoverAccounts(tokenSet) {
    const me = await getJson<{
      username: string;
      id?: string;
      account_type?: string;
    }>("https://api.pinterest.com/v5/user_account", {
      Authorization: `Bearer ${tokenSet.accessToken}`,
    });
    return [
      {
        platformId: "pinterest",
        externalId: me.id ?? me.username,
        handle: `@${me.username}`,
        displayName: me.username,
        credentialPayload: { ...tokenSet },
        scopes: tokenSet.scopes,
        expiresAt: tokenSet.expiresAt,
      },
    ];
  },
};
