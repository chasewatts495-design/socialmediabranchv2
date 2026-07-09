import type { PlatformDefinition } from "./def";

export const xDef: PlatformDefinition = {
  capabilities: {
    platformId: "x",
    displayName: "X (Twitter)",
    brandColor: "#cbd5e1",
    canPublish: true,
    canFetchAccountStats: false, // follower history not exposed on affordable tiers
    canFetchPostStats: true,
    supportedMedia: ["text", "image", "video", "link"],
    constraints: {
      maxCaptionChars: 280,
      maxMediaPerPost: 4,
      requiresMedia: false,
      video: { maxDurationSec: 140, maxBytes: 512_000_000 },
      image: { maxBytes: 5_000_000, formats: ["jpeg", "png", "gif", "webp"] },
      linksSuppressed: true,
    },
    auth: {
      kind: "api_key",
      credentialFields: [
        { key: "apiKey", label: "API key", secret: false },
        { key: "apiSecret", label: "API key secret", secret: true },
        { key: "accessToken", label: "Access token", secret: true },
        { key: "accessSecret", label: "Access token secret", secret: true },
      ],
    },
    access: {
      costTier: "paid",
      approval: "Near-instant, but requires a card on file — X has no free API tier for new developers (since Feb 2026).",
      notes: [
        "Pay-per-use: roughly $0.015 per post created (about $0.20 if it contains a link); reads billed separately.",
        "Light single-brand posting ≈ a few dollars per month.",
        "Follower/impression history isn't available on the affordable tiers — X analytics in Branch stay at per-post metrics.",
      ],
    },
    wizardSteps: [
      {
        title: "Create a developer account",
        body: "Go to developer.x.com and sign up with the X account you post from. Attach a payment method (pay-per-use billing).",
      },
      {
        title: "Create a project + app",
        body: "In the developer portal create a Project, then an App inside it. Set app permissions to 'Read and write'.",
      },
      {
        title: "Generate keys and tokens",
        body: "In the app's 'Keys and tokens' tab, generate the API key/secret pair and an Access token/secret for your account.",
      },
      {
        title: "Mind the cost",
        body: "Every API post is billed (~$0.015; ~$0.20 with a link). Branch will always show you what's about to be posted before it goes out.",
      },
      {
        title: "Paste credentials below",
        body: "Enter all four values, then hit 'Test connection'.",
      },
    ],
  },
};
