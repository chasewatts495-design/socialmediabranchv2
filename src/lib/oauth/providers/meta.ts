import type { DiscoveredAccount, OAuthProvider, TokenSet } from "../types";
import { expiresAtFrom, getJson } from "./http";

/**
 * Meta (Facebook Pages + Instagram professional accounts) — one Business
 * app covers both platforms. The short-lived user token is immediately
 * exchanged for a long-lived one (~60 days); Page tokens derived from a
 * long-lived user token do not expire. There is no refresh grant — when
 * the user token dies the owner reconnects.
 */

export const META_GRAPH_VERSION = "v23.0";
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "read_insights",
  "business_management",
];

interface FbTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export const metaProvider: OAuthProvider = {
  key: "meta",
  displayName: "Meta (Instagram + Facebook)",
  platformIds: ["instagram", "facebook"],

  authorizeUrl({ creds, redirectUri, state }) {
    const q = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: META_SCOPES.join(","),
      state,
    });
    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${q}`;
  },

  async exchangeCode({ code, redirectUri, creds }) {
    const short = await getJson<FbTokenResponse>(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: creds.clientId,
          redirect_uri: redirectUri,
          client_secret: creds.clientSecret,
          code,
        }),
    );
    // Upgrade to the ~60-day long-lived user token straight away.
    const long = await getJson<FbTokenResponse>(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          fb_exchange_token: short.access_token,
        }),
    );
    return {
      accessToken: long.access_token,
      expiresAt: expiresAtFrom(long.expires_in ?? 60 * 86_400),
      tokenType: long.token_type,
      scopes: META_SCOPES,
    };
  },

  async discoverAccounts(tokenSet: TokenSet) {
    const pages = await getJson<{
      data?: {
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: {
          id: string;
          username?: string;
          name?: string;
        };
      }[];
    }>(
      `${GRAPH}/me/accounts?` +
        new URLSearchParams({
          fields:
            "id,name,access_token,instagram_business_account{id,username,name}",
          limit: "50",
          access_token: tokenSet.accessToken,
        }),
    );

    const out: DiscoveredAccount[] = [];
    for (const page of pages.data ?? []) {
      out.push({
        platformId: "facebook",
        externalId: page.id,
        handle: page.name,
        displayName: page.name,
        credentialPayload: {
          ...tokenSet,
          pageId: page.id,
          // Page tokens from a long-lived user token don't expire.
          pageToken: page.access_token,
        },
        scopes: tokenSet.scopes,
        expiresAt: tokenSet.expiresAt,
      });
      const ig = page.instagram_business_account;
      if (ig) {
        out.push({
          platformId: "instagram",
          externalId: ig.id,
          handle: ig.username ? `@${ig.username}` : (ig.name ?? ig.id),
          displayName: ig.name ?? ig.username ?? "Instagram",
          credentialPayload: {
            ...tokenSet,
            igUserId: ig.id,
            pageId: page.id,
            pageToken: page.access_token,
          },
          scopes: tokenSet.scopes,
          expiresAt: tokenSet.expiresAt,
        });
      }
    }
    if (out.length === 0) {
      throw new Error(
        "No Facebook Pages found. Branch needs a Page (and an Instagram professional account linked to it) — and your Facebook user must have a role on the app.",
      );
    }
    return out;
  },
};
