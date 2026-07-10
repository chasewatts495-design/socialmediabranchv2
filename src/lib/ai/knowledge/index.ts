import type { PlatformId } from "@/lib/connectors/types";

import igAlgo from "./algorithms/instagram";
import fbAlgo from "./algorithms/facebook";
import ttAlgo from "./algorithms/tiktok";
import xAlgo from "./algorithms/x";
import ytAlgo from "./algorithms/youtube";
import rdAlgo from "./algorithms/reddit";
import pinAlgo from "./algorithms/pinterest";
import scAlgo from "./algorithms/snapchat";

import igCases from "./case-studies/instagram";
import fbCases from "./case-studies/facebook";
import ttCases from "./case-studies/tiktok";
import xCases from "./case-studies/x";
import ytCases from "./case-studies/youtube";
import rdCases from "./case-studies/reddit";
import pinCases from "./case-studies/pinterest";
import scCases from "./case-studies/snapchat";

import igInfl from "./influencers/instagram";
import fbInfl from "./influencers/facebook";
import ttInfl from "./influencers/tiktok";
import xInfl from "./influencers/x";
import ytInfl from "./influencers/youtube";
import rdInfl from "./influencers/reddit";
import pinInfl from "./influencers/pinterest";
import scInfl from "./influencers/snapchat";

import selling from "./psychology/selling";
import attention from "./psychology/attention";

export const KNOWLEDGE: {
  algorithms: Record<PlatformId, string>;
  caseStudies: Record<PlatformId, string>;
  influencers: Record<PlatformId, string>;
  psychology: { selling: string; attention: string };
} = {
  algorithms: {
    instagram: igAlgo, facebook: fbAlgo, tiktok: ttAlgo, x: xAlgo,
    youtube: ytAlgo, reddit: rdAlgo, pinterest: pinAlgo, snapchat: scAlgo,
  },
  caseStudies: {
    instagram: igCases, facebook: fbCases, tiktok: ttCases, x: xCases,
    youtube: ytCases, reddit: rdCases, pinterest: pinCases, snapchat: scCases,
  },
  influencers: {
    instagram: igInfl, facebook: fbInfl, tiktok: ttInfl, x: xInfl,
    youtube: ytInfl, reddit: rdInfl, pinterest: pinInfl, snapchat: scInfl,
  },
  psychology: { selling, attention },
};
