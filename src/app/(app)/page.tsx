import Link from "next/link";
import { desc } from "drizzle-orm";
import { ensureSeeded } from "@/lib/db/ensure-seeded";
import { getDb } from "@/lib/db/client";
import { trendScans } from "@/lib/db/schema";
import type { TrendReport } from "@/lib/trends/types";
import { getDashboardData } from "@/lib/db/queries";
import { brandScope, getActiveBrand, getActiveBrandId } from "@/lib/brands";
import { getGoLiveState } from "@/lib/golive";
import { getBestHours } from "@/lib/db/composer-queries";
import { GoLiveChecklist } from "@/components/dashboard/GoLiveChecklist";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Tilt } from "@/components/ui/Tilt";
import { HoloSphere } from "@/components/branch/HoloSphere";
import { RingGauge } from "@/components/hud/RingGauge";
import { ArcRings } from "@/components/hud/ArcRings";
import { PLATFORM_CHART_COLORS } from "@/lib/metrics/colors";
import { FollowerTrendChart } from "@/components/charts/FollowerTrendChart";
import { EngagementBarChart } from "@/components/charts/EngagementBarChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { RangeToggle } from "@/components/dashboard/RangeToggle";
import { AccountAvatar } from "@/components/dashboard/AccountAvatar";
import { ModeChip, PlatformBadge } from "@/components/dashboard/PlatformBadge";
import {
  formatCompact,
  formatPct,
  pctDelta,
} from "@/lib/metrics/engagement";
import { relativeTime } from "@/lib/relative-time";
import type { PlatformId } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

function parseRange(v: string | undefined): number {
  const n = Number(v);
  return n === 7 || n === 30 || n === 90 ? n : 30;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await ensureSeeded();
  const range = parseRange((await searchParams).range);
  const activeBrand = await getActiveBrand();
  const goLive = await getGoLiveState();
  const data = await getDashboardData(
    range,
    brandScope(await getActiveBrandId()),
  );
  const t = data.totals;

  // Latest Trend Radar read-out for the teaser strip.
  const db = await getDb();
  const latestScan = await db.query.trendScans.findFirst({
    where: (t2, { eq: e }) => e(t2.status, "done"),
    orderBy: [desc(trendScans.createdAt)],
  });
  const latestPattern = latestScan
    ? ((latestScan.analysis as unknown as TrendReport | null)?.patterns[0] ??
      null)
    : null;

  // Next best posting slots: each account's strongest hour, ranked by how
  // much it beats the account's overall average (same data the composer's
  // best-time mode uses).
  const bestHours = await getBestHours(data.accounts.map((a) => a.id));
  const bestSlots = data.accounts
    .filter((a) => bestHours[a.id] !== undefined)
    .map((a) => ({
      accountId: a.id,
      handle: a.handle,
      platformId: a.platformId as PlatformId,
      hour: bestHours[a.id],
      er: a.engagementRate,
    }))
    .sort((a, b) => (b.er ?? 0) - (a.er ?? 0))
    .slice(0, 3);

  const statCards = [
    {
      label: "Total followers",
      value: formatCompact(t.followers),
      delta: pctDelta(t.followers, t.followersPrev),
      spark: data.totalFollowerSpark.map((d) => ({ value: d.value })),
    },
    {
      label: `Reach (${range}d)`,
      value: formatCompact(t.reach),
      delta: pctDelta(t.reach, t.reachPrev),
      spark: null,
    },
    {
      label: `Impressions (${range}d)`,
      value: formatCompact(t.impressions),
      delta: pctDelta(t.impressions, t.impressionsPrev),
      spark: null,
    },
    {
      label: "Avg engagement rate",
      value: formatPct(t.er),
      delta: pctDelta(t.er, t.erPrev),
      spark: null,
    },
  ];

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ArcRings className="h-9 w-9 md:h-10 md:w-10" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              Dashboard
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted md:text-sm">
              {activeBrand ? activeBrand.name : "All brands"} ·{" "}
              {data.accounts.length} account{data.accounts.length === 1 ? "" : "s"}{" "}
              · last {range} days
            </p>
          </div>
        </div>
        <RangeToggle current={range} />
      </div>

      {/* Command deck: the interactive network globe */}
      <Card className="hud-float relative overflow-hidden">
        <div className="grid items-center md:grid-cols-[1fr_minmax(260px,420px)]">
          <div className="relative z-10 p-5 md:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
              Branch network
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              {data.accounts.length} account
              {data.accounts.length === 1 ? "" : "s"} ·{" "}
              {data.platformsInTrend.length} platform
              {data.platformsInTrend.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-muted md:text-sm">
              {activeBrand
                ? `${activeBrand.name} command deck`
                : "Every brand, one command deck"}{" "}
              — <span className="boot-text">all systems reporting.</span>
            </p>
            <p className="mt-4 hidden text-[11px] text-faint md:block">
              Drag the globe to spin it — each orbiting node is a connected
              platform.
            </p>
          </div>
          <div className="h-44 md:h-56">
            <HoloSphere
              satellites={data.platformsInTrend.map(
                (pid) => PLATFORM_CHART_COLORS[pid],
              )}
            />
          </div>
        </div>
      </Card>

      <GoLiveChecklist state={goLive} />

      {latestScan && latestPattern && (
        <Card className="p-4" data-testid="trend-teaser">
          <Link
            href={`/trends?scan=${latestScan.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong">
              Trend Radar — “{latestScan.keyword}”
            </p>
            <span className="text-xs text-muted">
              <span className="font-medium text-ink">{latestPattern.name}:</span>{" "}
              {latestPattern.playbook}
            </span>
            <span className="ml-auto text-xs font-medium text-accent-strong">
              Full read-out →
            </span>
          </Link>
        </Card>
      )}

      {bestSlots.length > 0 && (
        <Card className="p-4" data-testid="best-slots">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong">
              Next best posting slots
            </p>
            {bestSlots.map((s) => (
              <Link
                key={s.accountId}
                href="/composer"
                className="flex items-center gap-2 text-xs text-muted transition hover:text-ink"
              >
                <PlatformBadge platformId={s.platformId} />
                <span className="font-medium text-ink">{s.handle}</span>
                <span>→ {s.hour}:00 UTC</span>
              </Link>
            ))}
            <span className="text-[10px] text-faint">
              from each account&apos;s own engagement history
            </span>
          </div>
        </Card>
      )}

      {/* Stat tiles: Jarvis radial readouts */}
      <div className="reveal-group grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s) => (
          <Tilt key={s.label}>
            <Card className="p-3 md:p-4">
              <RingGauge label={s.label} value={s.value} deltaPct={s.delta} />
              {s.spark && <Sparkline data={s.spark} />}
            </Card>
          </Tilt>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="scan-sweep hud-float lg:col-span-2">
          <CardHeader
            title="Follower growth"
            subtitle="Per platform, accounts combined"
          />
          <div className="p-4 md:p-5">
            <FollowerTrendChart
              data={data.followerTrend}
              platforms={data.platformsInTrend}
            />
          </div>
        </Card>
        <Card className="scan-sweep">
          <CardHeader
            title="Engagement by platform"
            subtitle="Engagements ÷ reach"
          />
          <div className="p-4 md:p-5">
            <EngagementBarChart data={data.engagementByPlatform} />
          </div>
        </Card>
      </div>

      {/* Accounts */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold md:text-base">Accounts</h2>
          <Link
            href="/connections"
            className="text-xs font-medium text-accent-strong hover:underline"
          >
            Manage connections →
          </Link>
        </div>
        <div className="reveal-group grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.accounts.map((a) => (
            <Link key={a.id} href={`/accounts/${a.id}`}>
              <Tilt max={4}>
              <Card className="p-4 transition hover:border-accent/50">
                <div className="flex items-center gap-3">
                  <AccountAvatar name={a.displayName} color={a.avatarColor} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{a.handle}</p>
                      <ModeChip mode={a.mode} />
                    </div>
                    <div className="mt-1">
                      <PlatformBadge platformId={a.platformId as PlatformId} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatCompact(a.latest?.followers)}
                    </p>
                    <p className="text-[11px] text-muted">followers</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      ER {formatPct(a.engagementRate)}
                    </p>
                  </div>
                </div>
              </Card>
              </Tilt>
            </Link>
          ))}
        </div>
      </section>

      {/* Top posts + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Top posts"
            subtitle={`Best engagement rate, last ${range} days`}
          />
          <ul className="divide-y divide-border">
            {data.topPosts.map((p) => (
              <li key={p.targetId} className="flex items-center gap-3 px-4 py-3 md:px-5">
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbnailUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs text-faint">
                    Aa
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.caption}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                    <PlatformBadge platformId={p.platformId} />
                    <span>{p.accountHandle}</span>
                    <span>·</span>
                    <span>{relativeTime(p.publishedAt)}</span>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold text-success">
                    {formatPct(p.metrics?.engagementRate)}
                  </p>
                  <p className="text-muted">
                    {formatCompact(p.metrics?.impressions)} impr.
                  </p>
                </div>
              </li>
            ))}
            {data.topPosts.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted">
                No published posts in this range yet.
              </li>
            )}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="divide-y divide-border">
            {data.activity.map((a) => (
              <li key={a.id} className="px-4 py-3 md:px-5">
                <p className="text-xs font-medium">{a.event}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {relativeTime(a.ts)}
                </p>
              </li>
            ))}
            {data.activity.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted">
                Nothing yet.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
