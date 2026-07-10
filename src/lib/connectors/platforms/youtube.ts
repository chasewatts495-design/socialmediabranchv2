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
      credentialFields: [],
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
        body: "console.cloud.google.com → New project. Enable 'YouTube Data API v3' and 'YouTube Analytics API' under APIs & Services.",
      },
      {
        title: "Configure the OAuth consent screen",
        body: "APIs & Services → OAuth consent screen → External → add yourself as a test user. Then push it to 'In production' (personal use needs no verification) so your connection doesn't expire weekly.",
      },
      {
        title: "Create a Web OAuth client",
        body: "APIs & Services → Credentials → Create credentials → OAuth client ID → Web application. Add the Redirect URI shown below, then copy the client ID and secret into Branch.",
      },
      {
        title: "Hit Connect",
        body: "A Google login window opens — you approve the read-only YouTube scopes there. Branch pulls subscribers, daily views, watch time, and per-video stats immediately.",
      },
      {
        title: "Uploads stay in YouTube Studio (for now)",
        body: "API uploads are forced private until Google audits an app, so Branch doesn't pretend to publish — upload in Studio and the video plus its stats sync here.",
      },
    ],
  },
};
