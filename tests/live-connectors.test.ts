import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { ConnectorContext } from "@/lib/connectors/types";

vi.mock("@/lib/connectors/live/http", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/connectors/live/http")>();
  return { ...mod, liveFetch: vi.fn() };
});

import { liveFetch, LiveHttpError } from "@/lib/connectors/live/http";
import { publishFailure } from "@/lib/connectors/live/base";
import { RedditLiveConnector } from "@/lib/connectors/live/reddit";
import { PinterestLiveConnector } from "@/lib/connectors/live/pinterest";
import { YouTubeLiveConnector } from "@/lib/connectors/live/youtube";
import { FacebookLiveConnector } from "@/lib/connectors/live/facebook";
import { InstagramLiveConnector } from "@/lib/connectors/live/instagram";
import { redditDef } from "@/lib/connectors/platforms/reddit";
import { pinterestDef } from "@/lib/connectors/platforms/pinterest";
import { youtubeDef } from "@/lib/connectors/platforms/youtube";
import { facebookDef } from "@/lib/connectors/platforms/facebook";
import { instagramDef } from "@/lib/connectors/platforms/instagram";

const fetchMock = liveFetch as unknown as Mock;

function ctxWith(payload: Record<string, unknown>): ConnectorContext {
  return {
    account: {
      id: "acc-1",
      platformId: "reddit",
      handle: "@test",
      mode: "live",
    },
    getCredentials: async <T,>() => payload as T,
    saveCredentials: async () => {},
    log: async () => {},
  };
}

const REDDIT_CREDS = {
  clientId: "cid",
  clientSecret: "cs",
  username: "brancher",
  password: "hunter2",
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe("error mapping", () => {
  it("classifies platform failures honestly", () => {
    expect(publishFailure(new LiveHttpError(429, "slow down", "u")).retryable).toBe(true);
    expect(publishFailure(new LiveHttpError(503, "oops", "u")).retryable).toBe(true);
    const auth = publishFailure(new LiveHttpError(401, "no", "u"));
    expect(auth.retryable).toBe(false);
    expect(auth.errorCode).toBe("AUTH_EXPIRED");
    expect(publishFailure(new LiveHttpError(400, "bad", "u")).retryable).toBe(false);
    expect(publishFailure(new TypeError("fetch failed")).retryable).toBe(true);
  });
});

describe("Reddit live connector", () => {
  it("test connection: password grant + /me", async () => {
    fetchMock
      .mockResolvedValueOnce({ access_token: "tok", expires_in: 3600 })
      .mockResolvedValueOnce({ name: "brancher", total_karma: 420 });
    const c = new RedditLiveConnector(redditDef);
    const res = await c.testConnection(ctxWith(REDDIT_CREDS));
    expect(res.ok).toBe(true);
    expect(res.message).toContain("u/brancher");
    // Token endpoint used HTTP Basic + a descriptive User-Agent.
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toContain("reddit.com/api/v1/access_token");
    expect(tokenInit.headers.Authorization).toMatch(/^Basic /);
    expect(tokenInit.headers["User-Agent"]).toContain("brancher");
  });

  it("publishes a text post and returns the reddit name", async () => {
    fetchMock
      .mockResolvedValueOnce({ access_token: "tok", expires_in: 3600 })
      .mockResolvedValueOnce({
        json: { errors: [], data: { name: "t3_abc123", url: "https://redd.it/abc123" } },
      });
    const c = new RedditLiveConnector(redditDef);
    const res = await c.publishPost(ctxWith(REDDIT_CREDS), {
      caption: "hello world",
      media: [],
      meta: { subreddit: "r/test", title: "Hi" },
    });
    expect(res).toMatchObject({ ok: true, externalPostId: "t3_abc123" });
    const [, submitInit] = fetchMock.mock.calls[1];
    expect(submitInit.form.sr).toBe("test"); // r/ prefix stripped
    expect(submitInit.form.kind).toBe("self");
  });

  it("maps Reddit API errors (ratelimit → retryable)", async () => {
    fetchMock
      .mockResolvedValueOnce({ access_token: "tok", expires_in: 3600 })
      .mockResolvedValueOnce({
        json: { errors: [["RATELIMIT", "you're doing that too much"]] },
      });
    const c = new RedditLiveConnector(redditDef);
    const res = await c.publishPost(ctxWith(REDDIT_CREDS), {
      caption: "x",
      media: [],
      meta: { subreddit: "test", title: "t" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorCode).toBe("RATELIMIT");
      expect(res.retryable).toBe(true);
    }
  });

  it("maps submitted posts to per-post metrics", async () => {
    fetchMock
      .mockResolvedValueOnce({ access_token: "tok", expires_in: 3600 })
      .mockResolvedValueOnce({
        data: {
          children: [
            {
              data: {
                name: "t3_zzz",
                title: "old post",
                permalink: "/r/test/comments/zzz/",
                score: 42,
                num_comments: 7,
                created_utc: 1_700_000_000,
              },
            },
          ],
        },
      });
    const c = new RedditLiveConnector(redditDef);
    const posts = await c.fetchRecentPosts(ctxWith(REDDIT_CREDS), { limit: 10 });
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      externalId: "t3_zzz",
      metrics: { likes: 42, comments: 7 },
    });
  });
});

describe("Pinterest live connector", () => {
  const payload = { accessToken: "p-at", scopes: ["pins:write"] };

  it("requires a board id before touching the API", async () => {
    const c = new PinterestLiveConnector(pinterestDef);
    const res = await c.publishPost(ctxWith(payload), {
      caption: "pin!",
      media: [
        { url: "https://cdn.example/img.png", mimeType: "image/png", sizeBytes: 1000 },
      ],
      meta: { title: "T" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe("BOARD_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a pin on the given board", async () => {
    fetchMock.mockResolvedValueOnce({ id: "pin-77" });
    const c = new PinterestLiveConnector(pinterestDef);
    const res = await c.publishPost(ctxWith(payload), {
      caption: "pin!",
      media: [
        { url: "https://cdn.example/img.png", mimeType: "image/png", sizeBytes: 1000 },
      ],
      meta: { title: "T", boardId: "12345" },
    });
    expect(res).toMatchObject({
      ok: true,
      externalPostId: "pin-77",
      url: "https://www.pinterest.com/pin/pin-77/",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.json.board_id).toBe("12345");
    expect(init.json.media_source.url).toContain("img.png");
  });

  it("maps daily analytics + follower snapshot", async () => {
    fetchMock
      .mockResolvedValueOnce({
        all: {
          daily_metrics: [
            { date: "2026-07-08", metrics: { IMPRESSION: 100, ENGAGEMENT: 9, SAVE: 3 } },
            { date: "2026-07-09", metrics: { IMPRESSION: 140, ENGAGEMENT: 12, SAVE: 5 } },
          ],
        },
      })
      .mockResolvedValueOnce({ follower_count: 5300 });
    const c = new PinterestLiveConnector(pinterestDef);
    const rows = await c.fetchAccountStats(ctxWith(payload), {
      sinceDate: "2026-07-08",
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2026-07-08", impressions: 100, saves: 3 });
    expect(rows[1].followers).toBe(5300);
  });
});

describe("YouTube live connector", () => {
  const payload = { accessToken: "g-at", channelId: "UC1" };

  it("maps Analytics API day rows into normalized stats", async () => {
    fetchMock
      .mockResolvedValueOnce({
        rows: [
          ["2026-07-08", 1000, 300, 50, 10, 5, 12],
          ["2026-07-09", 1200, 350, 60, 12, 6, 15],
        ],
      })
      .mockResolvedValueOnce({
        items: [{ statistics: { subscriberCount: "8200", videoCount: "97" } }],
      });
    const c = new YouTubeLiveConnector(youtubeDef);
    const rows = await c.fetchAccountStats(ctxWith(payload), {
      sinceDate: "2026-07-08",
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-07-08",
      videoViews: 1000,
      watchTimeSec: 18000,
      engagements: 65,
    });
    expect(rows[1].followers).toBe(8200);
    expect(rows[1].postCount).toBe(97);
  });

  it("is honest that uploads go through YouTube Studio", async () => {
    const c = new YouTubeLiveConnector(youtubeDef);
    const res = await c.publishPost(ctxWith(payload), {
      caption: "video",
      media: [],
      meta: {},
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorCode).toBe("UPLOAD_VIA_STUDIO");
      expect(res.retryable).toBe(false);
    }
  });
});

describe("Meta live connectors", () => {
  const fbPayload = { accessToken: "u-at", pageId: "pg1", pageToken: "pt1" };
  const igPayload = { accessToken: "u-at", igUserId: "ig1", pageToken: "pt1" };

  it("facebook publishes a text post to the Page feed", async () => {
    fetchMock.mockResolvedValueOnce({ id: "pg1_post9" });
    const c = new FacebookLiveConnector(facebookDef);
    const res = await c.publishPost(ctxWith(fbPayload), {
      caption: "hello page",
      media: [],
      meta: {},
    });
    expect(res).toMatchObject({ ok: true, externalPostId: "pg1_post9" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/pg1/feed");
    expect(init.form.message).toBe("hello page");
  });

  it("instagram refuses non-public media with a clear reason", async () => {
    const c = new InstagramLiveConnector(instagramDef);
    const res = await c.publishPost(ctxWith(igPayload), {
      caption: "post",
      media: [{ url: "data:image/svg+xml;utf8,x", mimeType: "image/svg+xml", sizeBytes: 10 }],
      meta: {},
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe("PUBLIC_URL_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("instagram runs the container → poll → publish pipeline", async () => {
    fetchMock
      .mockResolvedValueOnce({ id: "container-1" }) // create container
      .mockResolvedValueOnce({ status_code: "FINISHED" }) // poll
      .mockResolvedValueOnce({ id: "media-5" }) // publish
      .mockResolvedValueOnce({ permalink: "https://www.instagram.com/p/xyz/" });
    const c = new InstagramLiveConnector(instagramDef);
    const res = await c.publishPost(ctxWith(igPayload), {
      caption: "shipped",
      media: [
        { url: "https://blob.example/img.jpg", mimeType: "image/jpeg", sizeBytes: 5000 },
      ],
      meta: {},
    });
    expect(res).toMatchObject({
      ok: true,
      externalPostId: "media-5",
      url: "https://www.instagram.com/p/xyz/",
    });
    expect(fetchMock.mock.calls[2][0]).toContain("/media_publish");
  });
});
