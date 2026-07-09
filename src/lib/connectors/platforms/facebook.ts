import type { PlatformDefinition } from "./def";

export const facebookDef: PlatformDefinition = {
  capabilities: {
    platformId: "facebook",
    displayName: "Facebook",
    brandColor: "#1877f2",
    canPublish: true,
    canFetchAccountStats: true,
    canFetchPostStats: true,
    supportedMedia: ["text", "image", "video", "link", "carousel"],
    constraints: {
      maxCaptionChars: 63_206,
      maxMediaPerPost: 10,
      requiresMedia: false,
      video: { maxDurationSec: 14_400, maxBytes: 4_000_000_000 },
      image: { maxBytes: 10_000_000, formats: ["jpeg", "png", "gif"] },
    },
    auth: {
      kind: "oauth2",
      credentialFields: [
        {
          key: "pageAccessToken",
          label: "Page access token",
          secret: true,
          help: "A long-lived Page token from your Meta app (Graph API Explorer or API setup).",
        },
        {
          key: "pageId",
          label: "Facebook Page ID",
          secret: false,
        },
      ],
    },
    access: {
      costTier: "free",
      approval:
        "Instant for Pages you manage (same Meta app as Instagram); App Review only for Advanced Access.",
      notes: [
        "Pages only — personal profiles cannot be posted to via API.",
        "Page Insights metrics were reduced by Meta in 2024; core reach/engagement remain.",
        "Shares the same Meta developer app as your Instagram connection.",
      ],
    },
    wizardSteps: [
      {
        title: "Have a Facebook Page",
        body: "Posting targets a Page (not your profile). Create one at facebook.com/pages/create if needed.",
      },
      {
        title: "Use your Meta app",
        body: "The same app created for Instagram works here. In developers.facebook.com open your app (or create a Business-type app).",
      },
      {
        title: "Grant Page permissions",
        body: "Using Graph API Explorer (Tools → Graph API Explorer), select your app, click 'Get Page access token', and grant pages_manage_posts, pages_read_engagement, read_insights.",
      },
      {
        title: "Make the token long-lived",
        body: "Exchange the short token for a long-lived one (Meta docs: 'Long-Lived Page Access Tokens' — one API call, or use the Access Token Debugger's 'Extend' button).",
      },
      {
        title: "Find your Page ID",
        body: "On your Page → About → Page transparency, or from the Graph API Explorer response. It's a long number.",
      },
      {
        title: "Paste credentials below",
        body: "Enter the Page token and Page ID, then hit 'Test connection'.",
      },
    ],
  },
};
