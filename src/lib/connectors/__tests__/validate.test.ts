import { describe, expect, it } from "vitest";
import { capabilitiesFor, PLATFORM_DEFS } from "../registry";
import { truncateCaption, validateAgainstCapabilities } from "../validate";
import type { PublishPayload } from "../types";

const img = (over: Partial<PublishPayload["media"][number]> = {}) => ({
  url: "https://example.com/a.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 500_000,
  width: 1080,
  height: 1080,
  ...over,
});

const payload = (over: Partial<PublishPayload> = {}): PublishPayload => ({
  caption: "Hello world",
  media: [img()],
  meta: {},
  ...over,
});

describe("validateAgainstCapabilities", () => {
  it("rejects a 300-char caption on X but accepts it on Instagram", () => {
    const caption = "x".repeat(300);
    const x = validateAgainstCapabilities(capabilitiesFor("x"), payload({ caption, media: [] }));
    expect(x.valid).toBe(false);
    const issue = x.issues.find((i) => i.code === "CAPTION_TOO_LONG");
    expect(issue).toBeDefined();
    expect(issue!.autofix!.caption!.length).toBeLessThanOrEqual(280);

    const ig = validateAgainstCapabilities(
      capabilitiesFor("instagram"),
      payload({ caption }),
    );
    expect(ig.issues.find((i) => i.code === "CAPTION_TOO_LONG")).toBeUndefined();
    expect(ig.valid).toBe(true);
  });

  it("requires media on Instagram, TikTok, YouTube, Pinterest", () => {
    for (const p of ["instagram", "tiktok", "youtube", "pinterest"] as const) {
      const r = validateAgainstCapabilities(
        capabilitiesFor(p),
        payload({ media: [], meta: { title: "A title" } }),
      );
      expect(r.issues.some((i) => i.code === "MEDIA_REQUIRED"), p).toBe(true);
    }
    const x = validateAgainstCapabilities(capabilitiesFor("x"), payload({ media: [] }));
    expect(x.valid).toBe(true);
  });

  it("caps Instagram carousels at 10 items", () => {
    const r = validateAgainstCapabilities(
      capabilitiesFor("instagram"),
      payload({ media: Array.from({ length: 11 }, () => img()) }),
    );
    expect(r.issues.some((i) => i.code === "TOO_MANY_MEDIA")).toBe(true);
  });

  it("requires title + subreddit for Reddit", () => {
    const def = PLATFORM_DEFS.reddit;
    const r = validateAgainstCapabilities(
      def.capabilities,
      payload({ media: [] }),
      def.extraValidation,
    );
    expect(r.issues.some((i) => i.code === "TITLE_REQUIRED")).toBe(true);
    expect(r.issues.some((i) => i.code === "SUBREDDIT_REQUIRED")).toBe(true);
    expect(r.valid).toBe(false);
  });

  it("warns about links on X (reach suppression)", () => {
    const r = validateAgainstCapabilities(
      capabilitiesFor("x"),
      payload({ caption: "check https://example.com", media: [] }),
    );
    const warn = r.issues.find((i) => i.code === "LINK_REACH_PENALTY");
    expect(warn?.level).toBe("warning");
    expect(r.valid).toBe(true); // warnings don't block
  });

  it("rejects oversized/too-long video per platform limits", () => {
    const r = validateAgainstCapabilities(
      capabilitiesFor("x"),
      payload({
        media: [
          img({ mimeType: "video/mp4", durationSec: 200, sizeBytes: 600_000_000 }),
        ],
      }),
    );
    expect(r.issues.some((i) => i.code === "VIDEO_TOO_LONG")).toBe(true);
    expect(r.issues.some((i) => i.code === "VIDEO_TOO_LARGE")).toBe(true);
  });
});

describe("truncateCaption", () => {
  it("returns short captions untouched", () => {
    expect(truncateCaption("hi", 280)).toBe("hi");
  });
  it("truncates at a word boundary with ellipsis", () => {
    const out = truncateCaption("word ".repeat(100), 280);
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith("…")).toBe(true);
  });
});
