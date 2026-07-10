import type { PlatformDefinition } from "./def";
import type { PublishPayload, ValidationIssue } from "../types";

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
      // Connect flow: log in on Pinterest's own page — no pasted tokens.
      kind: "oauth2",
      credentialFields: [],
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
        body: "developers.pinterest.com → My apps → Create app. Trial access is granted instantly. In the app's settings, paste the Redirect URI shown below.",
      },
      {
        title: "Save the app keys in Branch",
        body: "Copy the App ID and App secret key from the app console into the 'Connect with Pinterest' card below.",
      },
      {
        title: "Hit Connect",
        body: "A Pinterest login window opens — you sign in on pinterest.com itself. Branch receives only revocable access tokens, never your password.",
      },
      {
        title: "Pick a board per pin",
        body: "Pins need a board — the composer's Fine-tune step has a Board ID field per Pinterest post (the ID is the number in the board's URL).",
      },
    ],
  },
  extraValidation: (payload: PublishPayload): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const boardId =
      typeof payload.meta.boardId === "string" ? payload.meta.boardId : "";
    if (!boardId.trim()) {
      issues.push({
        level: "warning",
        field: "meta",
        code: "BOARD_RECOMMENDED",
        message:
          "Live Pinterest publishing needs a Board ID (from the board's URL) — demo mode works without one.",
      });
    }
    return issues;
  },
  // buildLiveConnector is attached server-side by connectors/live/register
  // so client bundles (composer validation) never pull in the live layer.
};
