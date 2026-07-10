import type { PlatformDefinition } from "./def";

export const instagramDef: PlatformDefinition = {
  capabilities: {
    platformId: "instagram",
    displayName: "Instagram",
    brandColor: "#e4405f",
    canPublish: true,
    canFetchAccountStats: true,
    canFetchPostStats: true,
    supportedMedia: ["image", "video", "carousel"],
    constraints: {
      maxCaptionChars: 2200,
      maxHashtags: 30,
      maxMediaPerPost: 10,
      requiresMedia: true,
      video: { maxDurationSec: 900, maxBytes: 300_000_000 },
      image: { maxBytes: 8_000_000, formats: ["jpeg", "png"] },
    },
    auth: {
      kind: "oauth2",
      credentialFields: [],
    },
    access: {
      costTier: "free",
      approval:
        "Instant for your own accounts (app in Dev Mode); Meta App Review (days–weeks) only if you later need Advanced Access.",
      notes: [
        "Requires an Instagram Business or Creator account linked to a Facebook Page.",
        "API allows ~50 published posts per account per 24 hours.",
        "Insights (reach, views, follower counts, per-post metrics) are included.",
      ],
    },
    wizardSteps: [
      {
        title: "Make Instagram professional + link a Facebook Page",
        body: "Instagram → Settings → Account type → switch to Business or Creator (free), then link it to a Facebook Page you manage — the API requires both.",
      },
      {
        title: "Create a Meta app",
        body: "developers.facebook.com → My apps → Create app → type Business. In app settings, add the Redirect URI shown below under Facebook Login → Settings → Valid OAuth Redirect URIs.",
      },
      {
        title: "Save the App ID + secret in Branch",
        body: "Both are on the app's Settings → Basic page. Development mode is fine — your own accounts work without App Review.",
      },
      {
        title: "Hit Connect and pick your accounts",
        body: "You log in on facebook.com itself; Branch then lists your Pages and linked Instagram profiles so you choose which to connect. Publishing needs publicly-hosted media — the deployed app (Vercel Blob) qualifies.",
      },
    ],
  },
};
