/**
 * The pluggable platform contract. Every platform — current or future —
 * implements this interface once; the rest of the app (composer, queue,
 * dashboard, wizards, AI strategist) only ever talks to it.
 */

export const PLATFORM_IDS = [
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "youtube",
  "reddit",
  "pinterest",
  "snapchat",
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

export type MediaKind = "image" | "video" | "carousel" | "text" | "link";
export type AccountMode = "demo" | "live" | "manual";

export interface CredentialField {
  key: string;
  label: string;
  secret: boolean;
  help?: string;
}

export interface ConnectorCapabilities {
  platformId: PlatformId;
  displayName: string;
  brandColor: string;
  canPublish: boolean; // false → manual checklist semantics
  canFetchAccountStats: boolean;
  canFetchPostStats: boolean;
  supportedMedia: MediaKind[];
  constraints: {
    maxCaptionChars: number;
    maxHashtags?: number;
    maxMediaPerPost: number;
    requiresMedia: boolean;
    requiresTitle?: boolean;
    titleMaxChars?: number;
    video?: { maxDurationSec: number; maxBytes: number };
    image?: { maxBytes: number; formats: string[] };
    linksSuppressed?: boolean; // reach penalty for external links
  };
  auth: {
    kind: "oauth2" | "api_key" | "manual";
    credentialFields: CredentialField[];
  };
  access: {
    costTier: "free" | "freemium" | "paid" | "unavailable";
    approval: string;
    notes: string[];
  };
  /** Step-by-step instructions rendered by the connection wizard. */
  wizardSteps: { title: string; body: string }[];
}

export interface NormalizedAccountStats {
  date: string; // YYYY-MM-DD
  followers?: number;
  following?: number;
  postCount?: number;
  impressions?: number;
  reach?: number;
  profileViews?: number;
  engagements?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  videoViews?: number;
  watchTimeSec?: number;
}

export interface NormalizedPost {
  externalId: string;
  url?: string;
  caption?: string;
  mediaKind: MediaKind;
  publishedAt: string; // ISO
  metrics: {
    impressions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    videoViews?: number;
  };
}

export interface PublishMedia {
  url: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
}

export interface PublishPayload {
  caption: string;
  media: PublishMedia[];
  /** Platform-specific extras (validated per platform): title, subreddit, boardId… */
  meta: Record<string, unknown>;
}

export type PublishResult =
  | { ok: true; externalPostId: string; url?: string }
  | { ok: false; errorCode: string; errorMessage: string; retryable: boolean };

export interface ValidationIssue {
  level: "error" | "warning";
  field: "caption" | "media" | "meta";
  code: string;
  message: string;
  autofix?: { caption?: string };
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ConnectorContext {
  account: {
    id: string;
    platformId: PlatformId;
    handle: string;
    mode: AccountMode;
  };
  getCredentials<T = Record<string, string>>(): Promise<T | null>;
  /**
   * Persists a refreshed credential payload (re-encrypted). Live
   * connectors call this after rotating OAuth tokens; demo/manual
   * connectors never need it, so it's optional on the context.
   */
  saveCredentials?(
    payload: Record<string, unknown>,
    opts?: { expiresAt?: Date | null },
  ): Promise<void>;
  log(event: string, detail?: Record<string, unknown>): Promise<void>;
}

export interface Connector {
  readonly capabilities: ConnectorCapabilities;
  testConnection(ctx: ConnectorContext): Promise<{
    ok: boolean;
    message?: string;
    profile?: { handle: string; displayName?: string };
  }>;
  fetchAccountStats(
    ctx: ConnectorContext,
    opts: { sinceDate: string },
  ): Promise<NormalizedAccountStats[]>;
  fetchRecentPosts(
    ctx: ConnectorContext,
    opts: { limit: number },
  ): Promise<NormalizedPost[]>;
  publishPost(
    ctx: ConnectorContext,
    payload: PublishPayload,
  ): Promise<PublishResult>;
  validateContent(payload: PublishPayload): ValidationResult;
}
