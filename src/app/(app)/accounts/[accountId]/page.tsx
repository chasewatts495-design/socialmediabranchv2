import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountDetail } from "@/lib/db/account-queries";
import { Card, CardHeader, StatDelta } from "@/components/ui/primitives";
import { AccountAvatar } from "@/components/dashboard/AccountAvatar";
import { ModeChip, PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { RangeToggle } from "@/components/dashboard/RangeToggle";
import { MetricLineChart } from "@/components/charts/MetricLineChart";
import { EngagementBreakdownChart } from "@/components/charts/EngagementBreakdownChart";
import { AccountPostsTable } from "@/components/account/AccountPostsTable";
import { ManualStatsForm } from "@/components/account/ManualStatsForm";
import { CsvImport } from "@/components/account/CsvImport";
import { syncNowAction } from "@/server/actions/accounts";
import { PLATFORM_CHART_COLORS } from "@/lib/metrics/colors";
import {
  formatCompact,
  formatPct,
  pctDelta,
} from "@/lib/metrics/engagement";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

function parseRange(v: string | undefined): number {
  const n = Number(v);
  return n === 7 || n === 30 || n === 90 ? n : 30;
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { accountId } = await params;
  const range = parseRange((await searchParams).range);
  const detail = await getAccountDetail(accountId, range);
  if (!detail) notFound();

  const { account, totals, series, posts } = detail;
  const color = PLATFORM_CHART_COLORS[account.platformId];
  const isManual = account.mode === "manual";

  const kpis = [
    {
      label: "Followers",
      value: formatCompact(totals.followers),
      delta: pctDelta(totals.followers, totals.followersStart),
    },
    {
      label: `Reach (${range}d)`,
      value: formatCompact(totals.reach),
      delta: pctDelta(totals.reach, totals.reachPrev),
    },
    {
      label: `Impressions (${range}d)`,
      value: formatCompact(totals.impressions),
      delta: pctDelta(totals.impressions, totals.impressionsPrev),
    },
    {
      label: "Engagement rate",
      value: formatPct(totals.er),
      delta: pctDelta(totals.er, totals.erPrev),
    },
  ];

  return (
    <div className="space-y-6 fade-up">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-ink">
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3 md:gap-4">
          <AccountAvatar
            name={account.displayName}
            color={account.avatarColor}
            size={48}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight md:text-2xl">
                {account.handle}
              </h1>
              <ModeChip mode={account.mode} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <PlatformBadge platformId={account.platformId} />
              <span>
                Last sync {relativeTime(account.lastSyncAt)}
                {account.syncError ? ` · ${account.syncError}` : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isManual && (
              <form action={syncNowAction.bind(null, account.id)}>
                <button
                  type="submit"
                  className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium transition hover:bg-surface-3"
                >
                  Sync now
                </button>
              </form>
            )}
            <Link
              href={`/connections/${account.platformId}`}
              className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium transition hover:bg-surface-3"
            >
              Connection
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {k.label}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-semibold md:text-xl">{k.value}</span>
              <StatDelta value={k.delta} />
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <RangeToggle current={range} />
      </div>

      {isManual && (
        <Card className="p-4 md:p-5">
          <h2 className="text-sm font-semibold">Manual data entry</h2>
          <p className="mt-1 mb-4 text-xs text-muted">
            {account.platformId === "snapchat"
              ? "Snapchat has no public API — record your numbers from the app's own insights."
              : "This account is in manual mode — record stats yourself."}
          </p>
          <div className="flex flex-wrap items-start gap-4">
            <ManualStatsForm accountId={account.id} />
            <CsvImport accountId={account.id} />
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Followers" />
          <div className="p-4 md:p-5">
            <MetricLineChart
              data={series}
              dataKey="followers"
              color={color}
              label="Followers"
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Impressions" />
          <div className="p-4 md:p-5">
            <MetricLineChart
              data={series}
              dataKey="impressions"
              color="#3d87f5"
              label="Impressions"
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Engagement breakdown"
          subtitle="Daily likes, comments, shares, saves"
        />
        <div className="p-4 md:p-5">
          <EngagementBreakdownChart data={series} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Posts" subtitle={`${posts.length} recorded`} />
        <AccountPostsTable posts={posts} />
      </Card>
    </div>
  );
}
