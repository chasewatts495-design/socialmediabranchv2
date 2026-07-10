import type { OAuthProvider, TokenSet } from "../types";
import { expiresAtFrom, getJson, postForm } from "./http";

/**
 * Google OAuth for YouTube (Data API v3 + Analytics API).
 * access_type=offline + prompt=consent forces a refresh token. While the
 * consent screen is in "Testing" status refresh tokens expire after 7
 * days — the wizard tells the owner to publish the consent screen.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

function toTokenSet(r: GoogleTokenResponse, fallbackRefresh?: string): TokenSet {
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? fallbackRefresh,
    expiresAt: expiresAtFrom(r.expires_in),
    tokenType: r.token_type,
    scopes: r.scope ? r.scope.split(" ") : GOOGLE_SCOPES,
  };
}

export const googleProvider: OAuthProvider = {
  key: "google",
  displayName: "YouTube (Google)",
  platformIds: ["youtube"],

  authorizeUrl({ creds, redirectUri, state }) {
    const q = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  },

  async exchangeCode({ code, redirectUri, creds }) {
    const r = await postForm<GoogleTokenResponse>(
      "https://oauth2.googleapis.com/token",
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      },
    );
    return toTokenSet(r);
  },

  async refresh(tokenSet, creds) {
    if (!tokenSet.refreshToken) throw new Error("No Google refresh token");
    const r = await postForm<GoogleTokenResponse>(
      "https://oauth2.googleapis.com/token",
      {
        grant_type: "refresh_token",
        refresh_token: tokenSet.refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      },
    );
    return toTokenSet(r, tokenSet.refreshToken);
  },

  async discoverAccounts(tokenSet) {
    const res = await getJson<{
      items?: {
        id: string;
        snippet?: { title?: string; customUrl?: string };
      }[];
    }>(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { Authorization: `Bearer ${tokenSet.accessToken}` },
    );
    const channel = res.items?.[0];
    if (!channel) {
      throw new Error(
        "No YouTube channel on this Google account — create one on youtube.com first.",
      );
    }
    return [
      {
        platformId: "youtube",
        externalId: channel.id,
        handle:
          channel.snippet?.customUrl ?? channel.snippet?.title ?? channel.id,
        displayName: channel.snippet?.title ?? "YouTube channel",
        credentialPayload: { ...tokenSet, channelId: channel.id },
        scopes: tokenSet.scopes,
        expiresAt: tokenSet.expiresAt,
      },
    ];
  },
};
