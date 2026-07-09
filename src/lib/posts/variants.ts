import type { PlatformId } from "@/lib/connectors/types";
import { capabilitiesFor } from "@/lib/connectors/registry";
import { truncateCaption } from "@/lib/connectors/validate";

export interface Variant {
  caption: string;
  meta: Record<string, unknown>;
}

function firstLine(text: string, max: number): string {
  const line = text.split("\n")[0]?.trim() ?? "";
  return truncateCaption(line || text.trim(), max);
}

/**
 * Auto-adapts a master caption to each platform's conventions. The owner can
 * still edit every variant by hand afterwards.
 */
export function adaptCaption(
  platformId: PlatformId,
  caption: string,
  opts: { accountHandle?: string } = {},
): Variant {
  const caps = capabilitiesFor(platformId);
  const meta: Record<string, unknown> = {};
  let text = caption;

  switch (platformId) {
    case "x": {
      text = truncateCaption(caption, caps.constraints.maxCaptionChars);
      break;
    }
    case "youtube": {
      meta.title = firstLine(caption, caps.constraints.titleMaxChars ?? 100);
      meta.privacy = "public";
      break;
    }
    case "reddit": {
      meta.title = firstLine(caption, caps.constraints.titleMaxChars ?? 300);
      // Sensible default: the brand's own subreddit derived from the handle.
      const handle = (opts.accountHandle ?? "").replace(/^(u\/|@)/, "");
      meta.subreddit = handle || "";
      break;
    }
    case "pinterest": {
      meta.title = firstLine(caption, caps.constraints.titleMaxChars ?? 100);
      text = truncateCaption(caption, caps.constraints.maxCaptionChars);
      break;
    }
    case "tiktok": {
      meta.privacyLevel = "PUBLIC_TO_EVERYONE";
      text = truncateCaption(caption, caps.constraints.maxCaptionChars);
      break;
    }
    case "instagram": {
      meta.postType = "feed";
      text = truncateCaption(caption, caps.constraints.maxCaptionChars);
      break;
    }
    default: {
      text = truncateCaption(caption, caps.constraints.maxCaptionChars);
    }
  }
  return { caption: text, meta };
}

/** Extra per-platform meta fields the variant editor should expose. */
export const META_FIELDS: Partial<
  Record<PlatformId, { key: string; label: string; placeholder?: string }[]>
> = {
  youtube: [{ key: "title", label: "Video title" }],
  reddit: [
    { key: "title", label: "Post title" },
    { key: "subreddit", label: "Subreddit", placeholder: "yourbrand (without r/)" },
  ],
  pinterest: [{ key: "title", label: "Pin title" }],
};
