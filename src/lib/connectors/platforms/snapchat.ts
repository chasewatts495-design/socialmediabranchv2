import type { PlatformDefinition } from "./def";

export const snapchatDef: PlatformDefinition = {
  capabilities: {
    platformId: "snapchat",
    displayName: "Snapchat",
    brandColor: "#fffc00",
    canPublish: false, // no public organic-posting API exists
    canFetchAccountStats: false,
    canFetchPostStats: false,
    supportedMedia: ["image", "video"],
    constraints: {
      maxCaptionChars: 250,
      maxMediaPerPost: 1,
      requiresMedia: true,
      video: { maxDurationSec: 60, maxBytes: 32_000_000 },
      image: { maxBytes: 10_000_000, formats: ["jpeg", "png"] },
    },
    auth: {
      kind: "manual",
      credentialFields: [],
    },
    access: {
      costTier: "unavailable",
      approval: "n/a — Snapchat has no public API for organic posting or profile analytics.",
      notes: [
        "The Marketing API is ads-only; Snap Kit only shares from third-party apps.",
        "Branch treats Snapchat as a manual platform: posts become a checklist item, stats are entered manually or imported via CSV.",
        "Your Snapchat numbers still appear in the unified dashboard and AI analysis.",
      ],
    },
    wizardSteps: [
      {
        title: "Why Snapchat is manual",
        body: "Snapchat offers no public API for posting Stories/Spotlight or reading profile analytics. No tool can automate this — Branch is honest about it instead of pretending.",
      },
      {
        title: "How posting works",
        body: "Include Snapchat when composing. Branch creates a 'post manually' checklist item with your caption and media; post it in the Snapchat app, then hit 'Mark published'.",
      },
      {
        title: "How stats work",
        body: "Open your account page and use 'Add stats' to record followers/views from Snapchat's own insights, or import a CSV. The dashboard and AI treat these like any other numbers.",
      },
    ],
  },
};
