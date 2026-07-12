import type { PlatformId } from "@/lib/connectors/types";

/**
 * One OAuth "provider" per developer app. Meta covers two platforms with
 * one app; every other provider maps 1:1.
 */

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when the access token dies; undefined → long-lived. */
  expiresAt?: number;
  tokenType?: string;
  scopes: string[];
}

export interface OAuthAppCreds {
  clientId: string;
  clientSecret: string;
  /** Meta "Facebook Login for Business" configuration id. Business-type
   * apps reject a raw scope list at the dialog; the configuration carries
   * the permission set instead. */
  configId?: string;
}

/**
 * An account the provider found after the token exchange. Meta returns
 * several (Pages + linked IG profiles); the rest return exactly one.
 * credentialPayload is what gets encrypted into the credentials row —
 * the TokenSet plus platform extras (pageId, igUserId, channelId…).
 */
export interface DiscoveredAccount {
  platformId: PlatformId;
  externalId: string;
  handle: string;
  displayName: string;
  credentialPayload: Record<string, unknown>;
  scopes: string[];
  expiresAt?: number;
}

export interface AuthorizeParams {
  creds: OAuthAppCreds;
  redirectUri: string;
  state: string;
  /** S256 code challenge — only set when the provider uses PKCE. */
  codeChallenge?: string;
}

export interface OAuthProvider {
  /** Key used in settings (`oauthApp.<key>`) and the /api/oauth/<key>/ URLs. */
  key: string;
  displayName: string;
  platformIds: PlatformId[];
  usesPkce?: boolean;
  authorizeUrl(params: AuthorizeParams): string;
  exchangeCode(args: {
    code: string;
    redirectUri: string;
    creds: OAuthAppCreds;
    codeVerifier?: string;
  }): Promise<TokenSet>;
  refresh?(tokenSet: TokenSet, creds: OAuthAppCreds): Promise<TokenSet>;
  discoverAccounts(
    tokenSet: TokenSet,
    creds: OAuthAppCreds,
  ): Promise<DiscoveredAccount[]>;
}
