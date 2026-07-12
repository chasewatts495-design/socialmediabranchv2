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
      credentialFields: [],
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
        title: "Create a Meta app (shared with Instagram)",
        body: "developers.facebook.com → My apps → Create app → type Business. One app covers Facebook Pages AND Instagram. Add the Redirect URI shown below under Facebook Login → Settings.",
      },
      {
        title: "Save the App ID + secret in Branch",
        body: "From the app's Settings → Basic page. Development mode works for every Page you have a role on — no App Review needed.",
      },
      {
        title: "Business login? Add a Configuration ID",
        body: "If Connect fails with \"Invalid Scopes\": in your Meta app open Facebook Login for Business → Configurations → Create, pick User access token, tick the pages_*, instagram_* and read_insights permissions, save, then paste the configuration's ID into Branch above.",
      },
      {
        title: "Hit Connect and pick your Pages",
        body: "You log in on facebook.com itself and grant Page permissions; Branch lists your Pages so you choose which to connect. Page tokens don't expire.",
      },
    ],
  },
};
