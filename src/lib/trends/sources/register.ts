import { registerTrendSource } from "../registry";
import { redditTrendSource } from "./reddit";
import { youtubeTrendSource } from "./youtube";
import { instagramTrendSource } from "./instagram";

/**
 * Server-only side-effect module — import from server call sites (actions,
 * scheduler, /trends page) exactly like connectors/live/register. Never
 * import from client components.
 *
 * TRENDS_FORCE_DEMO=1 skips live sources entirely so e2e runs and demo
 * deployments stay deterministic and offline.
 */

if (process.env.TRENDS_FORCE_DEMO !== "1") {
  registerTrendSource(redditTrendSource);
  registerTrendSource(youtubeTrendSource);
  registerTrendSource(instagramTrendSource);
}
