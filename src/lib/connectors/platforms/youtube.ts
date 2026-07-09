import type { PlatformDefinition } from "./def";

export const youtubeDef: PlatformDefinition = {
  capabilities: {
    platformId: "youtube",
    displayName: "YouTube",
    brandColor: "#ff4d4d",
    canPublish: true,
    canFetchAccountStats: true,
    canFetchPostStats: true,
    supportedMedia: ["video"],
    constraints: {
      maxCaptionChars: 5000, // description
      maxMediaPerPost: 1,
      requiresMedia: true,
      requiresTitle: true,
      titleMaxChars: 100,
      video: { maxDurationSec: 43_200, maxBytes: 128_000_000_000 },
    },
    auth: {
      kind: "oauth2",
      credentialFields: [
        { key: "clientId", label: "OAuth client ID", secret: false },
        { key: "clientSecret", label: "OAuth client secret", secret: true },
        {
          key: "refreshToken",
          label: "Refresh token",
          secret: true,
          help: "Obtained once via the OAuth consent flow for your Google account.",
        },
      ],
    },
    access: {
      costTier: "free",
      approval:
        "Analytics work immediately. Public uploads from an unverified API project require Google OAuth verification + YouTube API audit (weeks).",
      notes: [
        "Free quota is 10,000 units/day; one upload costs ~1,600 units (≈6 uploads/day).",
        "Videos uploaded by unaudited API projects are locked private.",
        "YouTube Analytics API is excellent: views, watch time, subscribers, per-video metrics.",
      ],
    },
    wizardSteps: [
      {
        title: "Create a Google Cloud project",
        body: "Go to console.cloud.google.com → New project. Enable 'YouTube Data API v3' and 'YouTube Analytics API' under APIs & Services.",
      },
      {
        title: "Configure the OAuth consent screen",
        body: "APIs & Services → OAuth consent screen. External type, add yourself as a test user. (Verification is only needed later for public uploads.)",
      },
      {
        title: "Create OAuth credentials",
        body: "APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app. Copy the client ID and secret.",
      },
      {
        title: "Authorize once to get a refresh token",
        body: "Run the OAuth flow with scopes youtube.upload, youtube.readonly, yt-analytics.readonly and capture the refresh token (Google's OAuth Playground works: developers.google.com/oauthplayground with your own credentials).",
      },
      {
        title: "Paste credentials below",
        body: "Enter client ID, client secret, and refresh token, then hit 'Test connection'. Start with analytics — uploads unlock after Google's audit.",
      },
    ],
  },
};
