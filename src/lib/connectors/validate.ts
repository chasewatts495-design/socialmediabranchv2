import type {
  ConnectorCapabilities,
  PublishPayload,
  ValidationIssue,
  ValidationResult,
} from "./types";

export function extractHashtags(text: string): string[] {
  return text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
}

/** Word-boundary truncation with an ellipsis, guaranteed ≤ max chars. */
export function truncateCaption(caption: string, max: number): string {
  if (caption.length <= max) return caption;
  const slice = caption.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

export function validateAgainstCapabilities(
  caps: ConnectorCapabilities,
  payload: PublishPayload,
  extra?: (payload: PublishPayload) => ValidationIssue[],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const c = caps.constraints;

  if (payload.caption.length > c.maxCaptionChars) {
    issues.push({
      level: "error",
      field: "caption",
      code: "CAPTION_TOO_LONG",
      message: `${caps.displayName} allows ${c.maxCaptionChars.toLocaleString()} characters — this caption is ${payload.caption.length.toLocaleString()}.`,
      autofix: { caption: truncateCaption(payload.caption, c.maxCaptionChars) },
    });
  }

  if (c.maxHashtags !== undefined) {
    const tags = extractHashtags(payload.caption);
    if (tags.length > c.maxHashtags) {
      issues.push({
        level: "warning",
        field: "caption",
        code: "TOO_MANY_HASHTAGS",
        message: `${tags.length} hashtags — ${caps.displayName} tolerates at most ${c.maxHashtags} before reach drops.`,
      });
    }
  }

  if (c.requiresMedia && payload.media.length === 0) {
    issues.push({
      level: "error",
      field: "media",
      code: "MEDIA_REQUIRED",
      message: `${caps.displayName} posts need at least one image or video.`,
    });
  }

  if (payload.media.length > c.maxMediaPerPost) {
    issues.push({
      level: "error",
      field: "media",
      code: "TOO_MANY_MEDIA",
      message: `${caps.displayName} allows at most ${c.maxMediaPerPost} media item${c.maxMediaPerPost === 1 ? "" : "s"} per post.`,
    });
  }

  for (const m of payload.media) {
    const isVideo = m.mimeType.startsWith("video/");
    const isImage = m.mimeType.startsWith("image/");

    if (isVideo && !caps.supportedMedia.includes("video")) {
      issues.push({
        level: "error",
        field: "media",
        code: "UNSUPPORTED_MEDIA",
        message: `${caps.displayName} does not accept video posts via API.`,
      });
    }
    if (
      isImage &&
      !caps.supportedMedia.includes("image") &&
      !caps.supportedMedia.includes("carousel")
    ) {
      issues.push({
        level: "error",
        field: "media",
        code: "UNSUPPORTED_MEDIA",
        message: `${caps.displayName} does not accept image posts via API.`,
      });
    }
    if (isVideo && c.video) {
      if (m.durationSec && m.durationSec > c.video.maxDurationSec) {
        issues.push({
          level: "error",
          field: "media",
          code: "VIDEO_TOO_LONG",
          message: `Video is ${m.durationSec}s — ${caps.displayName} caps at ${c.video.maxDurationSec}s.`,
        });
      }
      if (m.sizeBytes > c.video.maxBytes) {
        issues.push({
          level: "error",
          field: "media",
          code: "VIDEO_TOO_LARGE",
          message: `Video exceeds ${Math.round(c.video.maxBytes / 1_000_000)}MB limit for ${caps.displayName}.`,
        });
      }
    }
    if (isImage && c.image && m.sizeBytes > c.image.maxBytes) {
      issues.push({
        level: "error",
        field: "media",
        code: "IMAGE_TOO_LARGE",
        message: `Image exceeds ${Math.round(c.image.maxBytes / 1_000_000)}MB limit for ${caps.displayName}.`,
      });
    }
  }

  const title = typeof payload.meta.title === "string" ? payload.meta.title : "";
  if (c.requiresTitle && !title.trim()) {
    issues.push({
      level: "error",
      field: "meta",
      code: "TITLE_REQUIRED",
      message: `${caps.displayName} posts need a title.`,
    });
  }
  if (c.titleMaxChars && title.length > c.titleMaxChars) {
    issues.push({
      level: "error",
      field: "meta",
      code: "TITLE_TOO_LONG",
      message: `Title is ${title.length} characters — ${caps.displayName} caps at ${c.titleMaxChars}.`,
    });
  }

  if (c.linksSuppressed && /https?:\/\//i.test(payload.caption)) {
    issues.push({
      level: "warning",
      field: "caption",
      code: "LINK_REACH_PENALTY",
      message: `${caps.displayName} reduces reach on posts with external links — consider moving the link to a reply or bio.`,
    });
  }

  if (extra) issues.push(...extra(payload));

  return { valid: !issues.some((i) => i.level === "error"), issues };
}
