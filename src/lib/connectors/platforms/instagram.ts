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
      credentialFields: [
        {
          key: "accessToken",
          label: "Long-lived access token",
          secret: true,
          help: "Generated in Meta for Developers → your app → Instagram Graph API.",
        },
        {
          key: "igUserId",
          label: "Instagram Business account ID",
          secret: false,
          help: "Numeric ID of the IG professional account linked to your Facebook Page.",
        },
      ],
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
        title: "Convert to a professional account",
        body: "In the Instagram app: Settings → Account type and tools → Switch to professional account. Choose Business or Creator.",
      },
      {
        title: "Link a Facebook Page",
        body: "Instagram Settings → Business tools and controls → Connect a Facebook Page. Create one if you don't have it — the API only works through a linked Page.",
      },
      {
        title: "Create a Meta app",
        body: "Go to developers.facebook.com → My Apps → Create App → type 'Business'. No review is needed to use it with accounts you own.",
      },
      {
        title: "Add the Instagram product",
        body: "In the app dashboard, click 'Add product' → Instagram → API setup with Facebook login. Follow the setup to connect your Page + IG account.",
      },
      {
        title: "Generate a long-lived token",
        body: "In Instagram API setup, generate an access token for your account with instagram_basic, instagram_content_publish, instagram_manage_insights, pages_read_engagement scopes. Exchange it for a long-lived token (60 days) in the same screen.",
      },
      {
        title: "Find your IG user ID",
        body: "The API setup page displays your Instagram Business account ID (a long number). Copy it.",
      },
      {
        title: "Paste credentials below",
        body: "Enter the long-lived token and the IG user ID, then hit 'Test connection'.",
      },
    ],
  },
};
