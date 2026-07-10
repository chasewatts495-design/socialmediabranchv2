import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { brandScope, getActiveBrandId } from "@/lib/brands";
import { PLATFORM_DEFS } from "@/lib/connectors/registry";
import { PLATFORM_IDS } from "@/lib/connectors/types";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { AccountAvatar } from "@/components/dashboard/AccountAvatar";
import { ModeChip } from "@/components/dashboard/PlatformBadge";
import { PLATFORM_BADGE_COLORS } from "@/lib/metrics/colors";

export const dynamic = "force-dynamic";

const COST_TONE = {
  free: "success",
  freemium: "info",
  paid: "warning",
  unavailable: "danger",
} as const;

const COST_LABEL = {
  free: "Free API",
  freemium: "Free tier",
  paid: "Paid API",
  unavailable: "No public API",
} as const;

export default async function ConnectionsPage() {
  const db = await getDb();
  const brandId = brandScope(await getActiveBrandId());
  const accounts = await db.query.accounts.findMany({
    where: brandId ? (a, { eq }) => eq(a.brandId, brandId) : undefined,
    orderBy: (a, { asc }) => asc(a.sortOrder),
  });

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Connections
        </h1>
        <p className="mt-0.5 max-w-2xl text-xs text-muted md:text-sm">
          Every platform runs on demo data until you connect it. Each wizard
          walks you through getting the API credentials click by click — and is
          honest about what each platform actually allows.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {PLATFORM_IDS.map((pid) => {
          const caps = PLATFORM_DEFS[pid].capabilities;
          const platformAccounts = accounts.filter((a) => a.platformId === pid);
          return (
            <Card key={pid} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: PLATFORM_BADGE_COLORS[pid] }}
                  />
                  <h2 className="text-sm font-semibold">{caps.displayName}</h2>
                  <Badge tone={COST_TONE[caps.access.costTier]}>
                    {COST_LABEL[caps.access.costTier]}
                  </Badge>
                </div>
                <Link
                  href={`/connections/${pid}`}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-strong"
                >
                  Set up
                </Link>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                {caps.access.approval}
              </p>
              <div className="mt-3 space-y-1.5">
                {platformAccounts.length === 0 ? (
                  <p className="text-xs text-muted">No accounts yet.</p>
                ) : (
                  platformAccounts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <AccountAvatar
                        name={a.displayName}
                        color={a.avatarColor}
                        size={22}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">{a.handle}</span>
                      <ModeChip mode={a.mode} />
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Capability matrix"
          subtitle="What each platform's API actually allows — the honest version"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-2 font-medium md:px-5">Platform</th>
                <th className="px-3 py-2 font-medium">Auto-posting</th>
                <th className="px-3 py-2 font-medium">Analytics</th>
                <th className="px-3 py-2 font-medium">Cost</th>
                <th className="px-3 py-2 font-medium">Setup friction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PLATFORM_IDS.map((pid) => {
                const caps = PLATFORM_DEFS[pid].capabilities;
                return (
                  <tr key={pid}>
                    <td className="px-4 py-2.5 font-medium md:px-5">
                      {caps.displayName}
                    </td>
                    <td className="px-3 py-2.5">
                      {caps.canPublish ? (
                        <span className="text-success">Yes</span>
                      ) : (
                        <span className="text-warning">Manual only</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {caps.canFetchAccountStats ? (
                        <span className="text-success">Full</span>
                      ) : caps.canFetchPostStats ? (
                        <span className="text-info">Per-post only</span>
                      ) : (
                        <span className="text-warning">Manual / CSV</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={COST_TONE[caps.access.costTier]}>
                        {COST_LABEL[caps.access.costTier]}
                      </Badge>
                    </td>
                    <td className="max-w-[280px] px-3 py-2.5 text-muted">
                      {caps.access.approval}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
