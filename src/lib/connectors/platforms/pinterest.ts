import type { PlatformDefinition } from "./def";

export const pinterestDef: PlatformDefinition = {
  capabilities: {
    platformId: "pinterest",
    displayName: "Pinterest",
    brandColor: "#e60023",
    canPublish: true,
    canFetchAccountStats: true,
    canFetchPostStats: true,
    supportedMedia: ["image", "video"],
    constraints: {
      maxCaptionChars: 800, // description
      maxMediaPerPost: 5,
      requiresMedia: true,
      requiresTitle: true,
      titleMaxChars: 100,
      video: { maxDurationSec: 900, maxBytes: 2_000_000_000 },
      image: { maxBytes: 20_000_000, formats: ["jpeg", "png"] },
    },
    auth: {
      kind: "oauth2",
      credentialFields: [
        { key: "appId", label: "App ID", secret: false },
        { key: "appSecret", label: "App secret", secret: true },
        { key: "accessToken", label: "Access token", secret: true },
        {
          key: "boardId",
          label: "Default board ID",
          secret: false,
          help: "Pins need a board; Branch uses this one unless a post specifies another.",
        },
      ],
    },
    access: {
      costTier: "free",
      approval:
        "Trial access is instant (rate-limited); Standard access needs an app review (days–weeks). Business account required.",
      notes: [
        "Convert to a (free) Pinterest Business account first.",
        "Pin + account analytics (impressions, saves, clicks) are included.",
        "Pinterest content compounds — pins keep earning impressions for months.",
      ],
    },
    wizardSteps: [
      {
        title: "Convert to a Business account",
        body: "pinterest.com/business/convert — free, reversible, required for the API and analytics.",
      },
      {
        title: "Create a Pinterest app",
        body: "developers.pinterest.com → My apps → Create app. Trial access is granted instantly.",
      },
      {
        title: "Generate an access token",
        body: "In the app console, use the token generator with scopes boards:read, pins:read, pins:write, user_accounts:read.",
      },
      {
        title: "Pick a default board",
        body: "Create or choose the board Branch should pin to by default; its ID is in the board URL or via the API explorer.",
      },
      {
        title: "Paste credentials below",
        body: "Enter app ID, secret, token, and board ID, then hit 'Test connection'. Apply for Standard access when you're ready to scale.",
      },
    ],
  },
};
