import type { PlatformDefinition } from "./def";
import type { PublishPayload, ValidationIssue } from "../types";

export const redditDef: PlatformDefinition = {
  capabilities: {
    platformId: "reddit",
    displayName: "Reddit",
    brandColor: "#ff4500",
    canPublish: true,
    canFetchAccountStats: false, // no follower/impression history API
    canFetchPostStats: true,
    supportedMedia: ["text", "link", "image", "video"],
    constraints: {
      maxCaptionChars: 40_000, // selftext
      maxMediaPerPost: 1,
      requiresMedia: false,
      requiresTitle: true,
      titleMaxChars: 300,
      video: { maxDurationSec: 900, maxBytes: 1_000_000_000 },
      image: { maxBytes: 20_000_000, formats: ["jpeg", "png", "gif"] },
    },
    auth: {
      kind: "api_key",
      credentialFields: [
        { key: "clientId", label: "App client ID", secret: false },
        { key: "clientSecret", label: "App secret", secret: true },
        { key: "username", label: "Reddit username", secret: false },
        { key: "password", label: "Reddit password", secret: true },
      ],
    },
    access: {
      costTier: "free",
      approval: "Instant — self-serve app creation, no review.",
      notes: [
        "Free for non-commercial use up to 100 queries/min per client.",
        "Analytics are minimal: per-post score, upvote ratio, comments. No account-level history.",
        "Mind subreddit self-promotion rules (the 9:1 guideline) — the AI strategist accounts for this.",
      ],
    },
    wizardSteps: [
      {
        title: "Create a Reddit app",
        body: "Log in and open reddit.com/prefs/apps → 'create another app'. Choose type 'script', any name, redirect URI http://localhost.",
      },
      {
        title: "Copy the credentials",
        body: "The client ID is the string under the app name; the secret is labeled 'secret'.",
      },
      {
        title: "Paste credentials below",
        body: "Enter client ID, secret, and your Reddit login, then hit 'Test connection'. This is the easiest platform to go live on — no review, no cost.",
      },
    ],
  },
  extraValidation: (payload: PublishPayload): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const subreddit =
      typeof payload.meta.subreddit === "string" ? payload.meta.subreddit : "";
    if (!subreddit.trim()) {
      issues.push({
        level: "error",
        field: "meta",
        code: "SUBREDDIT_REQUIRED",
        message: "Reddit posts need a target subreddit (e.g. r/yourbrand).",
      });
    }
    return issues;
  },
};
