import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

const holder: { db?: Db } = {};
vi.mock("@/lib/db/client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...mod, getDb: async () => holder.db! };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/connectors/live/http", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("@/lib/connectors/live/http")>();
  return { ...mod, liveFetch: vi.fn() };
});

import { liveFetch } from "@/lib/connectors/live/http";
import { demoSignals } from "@/lib/trends/sources/demo";
import { redditTrendSource } from "@/lib/trends/sources/reddit";
import { rankSignals, runTrendScan } from "@/lib/trends/run";
import { demoReport } from "@/lib/trends/analyze";
import {
  __resetTrendSources,
  registerTrendSource,
} from "@/lib/trends/registry";
import type { TrendSignal } from "@/lib/trends/types";

const uuid = () => crypto.randomUUID();
let db: Db;

beforeAll(async () => {
  const pglite = new PGlite();
  const d = drizzle(pglite, { schema });
  await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
  holder.db = db;
});

beforeEach(() => {
  __resetTrendSources();
  vi.mocked(liveFetch).mockReset();
});

const sig = (over: Partial<TrendSignal>): TrendSignal => ({
  platformId: "reddit",
  keyword: "k",
  title: "t",
  url: `https://x/${uuid()}`,
  author: "a",
  postedAt: new Date().toISOString(),
  mediaType: "text",
  engagement: { score: 100 },
  heat: 0,
  source: "live",
  ...over,
});

describe("trend signal ranking", () => {
  it("normalizes heat per platform so platforms are comparable", () => {
    const ranked = rankSignals([
      sig({ platformId: "reddit", engagement: { score: 40_000 } }),
      sig({ platformId: "reddit", engagement: { score: 4_000 } }),
      sig({ platformId: "instagram", engagement: { score: 900 } }),
      sig({ platformId: "instagram", engagement: { score: 90 } }),
    ]);
    // Both platform leaders share heat 1 despite a 44× raw-score gap.
    const leaders = ranked.filter((s) => s.heat === 1);
    expect(leaders.map((s) => s.platformId).sort()).toEqual([
      "instagram",
      "reddit",
    ]);
    expect(ranked[2].heat).toBeCloseTo(0.1, 5);
  });

  it("demo generator is deterministic and labeled", () => {
    const a = demoSignals("sourdough");
    const b = demoSignals("sourdough");
    expect(a.map((s) => s.title)).toEqual(b.map((s) => s.title));
    expect(a.every((s) => s.source === "demo")).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(10);
    expect(demoSignals("drones")[0].title).not.toBe(a[0].title);
  });
});

describe("reddit public source", () => {
  it("maps listings to signals, skipping NSFW/stickied", async () => {
    const child = (over: Record<string, unknown>) => ({
      kind: "t3",
      data: {
        title: "Hot take",
        permalink: "/r/test/1",
        author: "u1",
        subreddit: "test",
        created_utc: 1_700_000_000,
        score: 500,
        num_comments: 42,
        ...over,
      },
    });
    vi.mocked(liveFetch).mockResolvedValue({
      data: {
        children: [
          child({}),
          child({ permalink: "/r/test/2", over_18: true }),
          child({ permalink: "/r/test/3", stickied: true }),
          child({ permalink: "/r/test/4", is_video: true, score: 900 }),
        ],
      },
    });
    const out = await redditTrendSource.scan("test");
    expect(out).toHaveLength(2);
    expect(out[0].engagement.score).toBe(900); // sorted desc
    expect(out[0].mediaType).toBe("video");
    expect(out[1].url).toBe("https://www.reddit.com/r/test/1");
    expect(out[1].author).toBe("r/test");
  });
});

describe("runTrendScan", () => {
  async function insertScan(keyword: string): Promise<string> {
    const id = uuid();
    await db
      .insert(schema.trendScans)
      .values({ id, keyword, platforms: [] });
    return id;
  }

  it("tolerates a failing source and completes with the healthy one", async () => {
    registerTrendSource({
      platformId: "reddit",
      label: "ok",
      unavailableHint: "",
      available: async () => true,
      scan: async () => [sig({ engagement: { score: 10 } })],
    });
    registerTrendSource({
      platformId: "youtube",
      label: "boom",
      unavailableHint: "",
      available: async () => true,
      scan: async () => {
        throw new Error("api down");
      },
    });
    const id = await insertScan("mixed");
    await runTrendScan(db, id);
    const row = await db.query.trendScans.findFirst({
      where: (t, { eq }) => eq(t.id, id),
    });
    expect(row!.status).toBe("done");
    expect((row!.signals as TrendSignal[]).length).toBe(1);
    expect(row!.error).toContain("youtube");
    const report = row!.analysis as { generatedBy: string; briefs: unknown[] };
    expect(report.generatedBy).toBe("demo"); // no Anthropic key in tests
    expect(report.briefs.length).toBeGreaterThan(0);
  });

  it("falls back to labeled demo signals when nothing live responds", async () => {
    const id = await insertScan("empty niche");
    await runTrendScan(db, id); // zero sources registered
    const row = await db.query.trendScans.findFirst({
      where: (t, { eq }) => eq(t.id, id),
    });
    expect(row!.status).toBe("done");
    const signals = row!.signals as TrendSignal[];
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.source === "demo")).toBe(true);
    const log = await db.query.activityLog.findMany({
      where: (l, { eq }) => eq(l.event, "trend.scan.completed"),
    });
    expect(log.length).toBeGreaterThan(0);
  });
});

describe("trend digest for the strategist", () => {
  it("summarizes recent done scans and skips pending ones", async () => {
    const { latestTrendDigest } = await import("@/lib/trends/digest");
    const { demoReport } = await import("@/lib/trends/analyze");
    const signals = rankSignals(demoSignals("vintage sneakers"));
    const report = demoReport({
      keyword: "vintage sneakers",
      signals,
      accounts: [{ handle: "@kicks", platformId: "instagram" }],
      bestHours: {},
    });
    await db.insert(schema.trendScans).values([
      {
        id: uuid(),
        keyword: "vintage sneakers",
        platforms: [],
        status: "done",
        signals,
        analysis: report as unknown as Record<string, unknown>,
      },
      { id: uuid(), keyword: "unfinished", platforms: [], status: "pending" },
    ]);
    const digest = await latestTrendDigest(db);
    expect(digest).toContain('Keyword "vintage sneakers"');
    expect(digest).toContain("Pattern —");
    expect(digest).toContain("Signal [");
    expect(digest).not.toContain("unfinished");

    // And the strategist prompt embeds it under the Trend Radar section.
    const { buildSystemPrompt } = await import("@/lib/ai/prompts");
    const prompt = buildSystemPrompt(
      "chat",
      {
        rangeDays: 90,
        generatedAt: new Date().toISOString(),
        accounts: [],
        crossPlatform: {
          bestPlatformByER: "",
          fastestGrowing: "",
          underperforming: [],
        },
      } as never,
      { trends: digest },
    );
    expect(prompt).toContain("Trend Radar — live niche signals");
    expect(prompt).toContain("vintage sneakers");
  });
});

describe("demo analysis", () => {
  it("builds briefs aimed at the owner's own platforms with best hours", () => {
    const report = demoReport({
      keyword: "streetwear",
      signals: rankSignals(demoSignals("streetwear")),
      accounts: [
        { handle: "@brand.ig", platformId: "instagram" },
        { handle: "Brand FB", platformId: "facebook" },
      ],
      bestHours: { instagram: 13 },
    });
    expect(report.generatedBy).toBe("demo");
    expect(report.patterns.length).toBeGreaterThanOrEqual(3);
    expect(report.briefs).toHaveLength(3);
    expect(report.briefs[0].platformId).toBe("instagram");
    expect(report.briefs[0].bestHourUtc).toBe(13);
    expect(report.summary).toContain("streetwear");
  });
});
