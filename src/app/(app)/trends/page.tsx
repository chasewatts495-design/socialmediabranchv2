import { desc } from "drizzle-orm";
import { ensureSeeded } from "@/lib/db/ensure-seeded";
import { getDb } from "@/lib/db/client";
import { trendScans } from "@/lib/db/schema";
import { ALL_BRANDS, getActiveBrandId } from "@/lib/brands";
import { listTrendSources } from "@/lib/trends/registry";
import "@/lib/trends/sources/register";
import type { TrendReport, TrendSignal } from "@/lib/trends/types";
import { listPinnedKeywords } from "@/server/actions/trends";
import { ArcRings } from "@/components/hud/ArcRings";
import { TrendsClient, type ScanRow } from "@/components/trends/TrendsClient";

export const dynamic = "force-dynamic";
/** Scans fan out to external APIs + Claude — give the action headroom. */
export const maxDuration = 60;

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string }>;
}) {
  await ensureSeeded();
  const { scan: scanParam } = await searchParams;
  const db = await getDb();
  const brandId = await getActiveBrandId();

  const history = await db.query.trendScans.findMany({
    where:
      brandId === ALL_BRANDS
        ? undefined
        : (t, { eq: e }) => e(t.brandId, brandId),
    orderBy: [desc(trendScans.createdAt)],
    limit: 12,
  });
  const selected =
    (scanParam && history.find((h) => h.id === scanParam)) ||
    history.find((h) => h.status === "done") ||
    history[0] ||
    null;
  // Selected scan may be outside the brand-scoped page of history.
  const full =
    scanParam && !selected
      ? ((await db.query.trendScans.findFirst({
          where: (t, { eq: e }) => e(t.id, scanParam),
        })) ?? null)
      : selected;

  const sources = listTrendSources();
  const availability = await Promise.all(
    sources.map(async (s) => ({
      platformId: s.platformId,
      label: s.label,
      available: await s.available().catch(() => false),
      hint: s.unavailableHint,
    })),
  );
  const pinned = await listPinnedKeywords();

  const toRow = (r: NonNullable<typeof full>): ScanRow => ({
    id: r.id,
    keyword: r.keyword,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    error: r.error,
    signals: (r.signals ?? []) as TrendSignal[],
    analysis: (r.analysis as unknown as TrendReport) ?? null,
  });

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center gap-3">
        <ArcRings className="h-9 w-9 md:h-10 md:w-10" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Trend Radar
          </h1>
          <p className="mt-0.5 text-xs text-muted md:text-sm">
            Scan your niche by keyword — see what&apos;s going viral right now,
            then turn it into posts that fit your brand.
          </p>
        </div>
      </div>
      <TrendsClient
        current={full ? toRow(full) : null}
        history={history.map((h) => ({
          id: h.id,
          keyword: h.keyword,
          status: h.status,
          createdAt: h.createdAt.toISOString(),
        }))}
        availability={availability}
        pinned={pinned}
      />
    </div>
  );
}
