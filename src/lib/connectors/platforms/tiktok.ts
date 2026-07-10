import type { PlatformDefinition } from "./def";

export const tiktokDef: PlatformDefinition = {
  capabilities: {
    platformId: "tiktok",
    displayName: "TikTok",
    brandColor: "#22d3ee",
    canPublish: true,
    canFetchAccountStats: true,
    canFetchPostStats: true,
    supportedMedia: ["video", "image", "carousel"],
    constraints: {
      maxCaptionChars: 2200,
      maxHashtags: 8,
      maxMediaPerPost: 10,
      requiresMedia: true,
      video: { maxDurationSec: 600, maxBytes: 4_000_000_000 },
      image: { maxBytes: 20_000_000, formats: ["jpeg", "png", "webp"] },
    },
    auth: {
      kind: "oauth2",
      credentialFields: [
        { key: "clientKey", label: "Client key", secret: false },
        { key: "clientSecret", label: "Client secret", secret: true },
        {
          key: "accessToken",
          label: "Access token",
          secret: true,
          help: "OAuth token for your account with video.publish + user.info scopes.",
        },
      ],
    },
    access: {
      costTier: "free",
      approval:
        "Developer app is self-serve, but the Content Posting API audit takes 2–4 weeks. Until audited, API posts are locked to private (SELF_ONLY).",
      notes: [
        "Unaudited apps: posts are visible only to you, max 5 posting users per 24h.",
        "Display API provides profile stats and metrics for your own videos.",
        "Plan the audit early — it's the real gate to public API posting.",
      ],
    },
    wizardSteps: [
      {
        title: "Create a developer app",
        body: "Go to developers.tiktok.com → Manage apps → Create app. Fill in basic details (name, category, description).",
      },
      {
        title: "Add Login Kit + Content Posting API",
        body: "In the app console add the products 'Login Kit' and 'Content Posting API', and request scopes user.info.basic, video.publish, video.list.",
      },
      {
        title: "Complete OAuth once",
        body: "Use the app's Login Kit flow to authorize your own TikTok account and capture the access + refresh tokens.",
      },
      {
        title: "Know the audit reality",
        body: "Until TikTok audits your app (2–4 weeks, sometimes multiple review rounds), everything you post via API stays private to your account. Analytics still work.",
      },
      {
        title: "Paste credentials below",
        body: "Enter client key, client secret, and your access token, then hit 'Test connection'.",
      },
    ],
  },
};
