/**
 * Server-side wiring of the live connectors. Imported ONLY from server
 * modules (publish pipeline, scheduler, server actions) — platform defs
 * and the registry stay browser-safe for the composer's client-side
 * validation, while live mode still resolves everywhere it matters.
 */

import { redditDef } from "../platforms/reddit";
import { pinterestDef } from "../platforms/pinterest";
import { youtubeDef } from "../platforms/youtube";
import { instagramDef } from "../platforms/instagram";
import { facebookDef } from "../platforms/facebook";
import { RedditLiveConnector } from "./reddit";
import { PinterestLiveConnector } from "./pinterest";
import { YouTubeLiveConnector } from "./youtube";
import { InstagramLiveConnector } from "./instagram";
import { FacebookLiveConnector } from "./facebook";

redditDef.buildLiveConnector = () => new RedditLiveConnector(redditDef);
pinterestDef.buildLiveConnector = () =>
  new PinterestLiveConnector(pinterestDef);
youtubeDef.buildLiveConnector = () => new YouTubeLiveConnector(youtubeDef);
instagramDef.buildLiveConnector = () =>
  new InstagramLiveConnector(instagramDef);
facebookDef.buildLiveConnector = () => new FacebookLiveConnector(facebookDef);
