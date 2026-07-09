import type { AccountMode, Connector, ConnectorCapabilities, PlatformId } from "./types";
import type { PlatformDefinition } from "./platforms/def";
import { DemoConnector, type DemoConnectorOptions } from "./demo/demo-connector";
import { ManualConnector } from "./manual/manual-connector";
import { NotImplementedError } from "./errors";

import { instagramDef } from "./platforms/instagram";
import { facebookDef } from "./platforms/facebook";
import { tiktokDef } from "./platforms/tiktok";
import { xDef } from "./platforms/x";
import { youtubeDef } from "./platforms/youtube";
import { redditDef } from "./platforms/reddit";
import { pinterestDef } from "./platforms/pinterest";
import { snapchatDef } from "./platforms/snapchat";

export const PLATFORM_DEFS: Record<PlatformId, PlatformDefinition> = {
  instagram: instagramDef,
  facebook: facebookDef,
  tiktok: tiktokDef,
  x: xDef,
  youtube: youtubeDef,
  reddit: redditDef,
  pinterest: pinterestDef,
  snapchat: snapchatDef,
};

export function capabilitiesFor(platformId: PlatformId): ConnectorCapabilities {
  return PLATFORM_DEFS[platformId].capabilities;
}

export interface AccountLike {
  platformId: PlatformId;
  mode: AccountMode;
}

/**
 * mode=demo   → DemoConnector (real constraints, simulated data)
 * mode=manual → ManualConnector (checklist publishing, manual stats)
 * mode=live   → the platform's real connector (Phase 2), else explains itself
 */
export function resolveConnector(
  account: AccountLike,
  opts: { demo?: DemoConnectorOptions } = {},
): Connector {
  const def = PLATFORM_DEFS[account.platformId];
  if (!def) throw new Error(`Unknown platform: ${account.platformId}`);

  if (account.mode === "manual" || !def.capabilities.canPublish) {
    if (account.mode === "demo") return new DemoConnector(def, opts.demo);
    return new ManualConnector(def);
  }
  if (account.mode === "live") {
    if (def.buildLiveConnector) return def.buildLiveConnector();
    throw new NotImplementedError(def.capabilities.displayName);
  }
  return new DemoConnector(def, opts.demo);
}
