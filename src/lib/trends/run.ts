import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { activityLog, trendScans } from "@/lib/db/schema";
import { getBestHours } from "@/lib/db/composer-queries";
import type { PlatformId } from "@/lib/connectors/types";
import { listTrendSources } from "./registry";
import { demoSignals } from "./sources/demo";
import { analyzeTrends } from "./analyze";
import type { TrendSignal } from "./types";

const uuid = () => crypto.randomUUID();

/** Per-source wall-clock budget — a slow platform can't stall the scan. */
const SOURCE_TIMEOUT_MS = 6_500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("source timed out")), ms),
    ),
  ]);
}

/**
 * Heat-normalize per platform (top post of each platform = 1) so a
 * 40k-upvote Reddit thread and a 900-like IG post can share one ranking.
 */
export function rankSignals(signals: TrendSignal[]): TrendSignal[] {
  const byPlatform = new Map<string, TrendSignal[]>();
  for (const s of signals) {
    const arr = byPlatform.get(s.platformId) ?? [];
    arr.push(s);
    byPlatform.set(s.platformId, arr);
  }
  const out: TrendSignal[] = [];
  for (const batch of byPlatform.values()) {
    const max = Math.max(1, ...batch.map((s) => s.engagement.score));
    for (const s of batch) out.push({ ...s, heat: s.engagement.score / max });
  }
  return out.sort((a, b) => b.heat - a.heat).slice(0, 40);
}

/**
 * Executes a scan row end-to-end: collect signals from every requested,
 * available source (partial failures tolerated), rank, analyze, persist.
 * Falls back to labeled demo signals when nothing live is reachable.
 */
export async function runTrendScan(db: Db, scanId: string): Promise<void> {
  const scan = await db.query.trendScans.findFirst({
    where: (t, { eq: e }) => e(t.id, scanId),
  });
  if (!scan || scan.status === "done") return;
  await db
    .update(trendScans)
    .set({ status: "running" })
    .where(eq(trendScans.id, scanId));

  try {
    const wanted = new Set(scan.platforms as string[]);
    const sources = listTrendSources().filter(
      (s) => wanted.size === 0 || wanted.has(s.platformId),
    );

    const settled = await Promise.allSettled(
      sources.map(async (source) => {
        if (!(await source.available())) return [];
        return withTimeout(source.scan(scan.keyword), SOURCE_TIMEOUT_MS);
      }),
    );
    const sourceErrors: string[] = [];
    let collected: TrendSignal[] = [];
    settled.forEach((res, i) => {
      if (res.status === "fulfilled") collected = collected.concat(res.value);
      else
        sourceErrors.push(
          `${sources[i].platformId}: ${res.reason instanceof Error ? res.reason.message : "failed"}`,
        );
    });

    if (collected.length === 0) collected = demoSignals(scan.keyword);
    const ranked = rankSignals(collected);

    const accounts = await db.query.accounts.findMany({
      where: scan.brandId
        ? (a, { eq: e }) => e(a.brandId, scan.brandId!)
        : undefined,
      columns: { id: true, handle: true, platformId: true },
    });
    const hours = await getBestHours(accounts.map((a) => a.id));
    const bestHours: Partial<Record<PlatformId, number>> = {};
    for (const a of accounts) {
      const h = hours[a.id];
      if (h !== undefined && bestHours[a.platformId as PlatformId] === undefined) {
        bestHours[a.platformId as PlatformId] = h;
      }
    }

    const analysis = await analyzeTrends({
      keyword: scan.keyword,
      signals: ranked,
      accounts: accounts.map((a) => ({
        handle: a.handle,
        platformId: a.platformId as PlatformId,
      })),
      bestHours,
    });

    await db
      .update(trendScans)
      .set({
        status: "done",
        signals: ranked,
        analysis: analysis as unknown as Record<string, unknown>,
        error: sourceErrors.length ? sourceErrors.join(" · ") : null,
        finishedAt: new Date(),
      })
      .where(eq(trendScans.id, scanId));
    await db.insert(activityLog).values({
      id: uuid(),
      event: "trend.scan.completed",
      detail: {
        keyword: scan.keyword,
        signals: ranked.length,
        live: ranked.some((s) => s.source === "live"),
      },
    });
  } catch (err) {
    await db
      .update(trendScans)
      .set({
        status: "failed",
        error: err instanceof Error ? err.message.slice(0, 500) : "Scan failed",
        finishedAt: new Date(),
      })
      .where(eq(trendScans.id, scanId));
  }
}
