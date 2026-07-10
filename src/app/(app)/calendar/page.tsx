import Link from "next/link";
import {
  getCalendarPosts,
  getQueueRows,
  getRecyclingOverview,
} from "@/lib/db/calendar-queries";
import { brandScope, getActiveBrandId } from "@/lib/brands";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { QueueTable } from "@/components/calendar/QueueTable";
import { RecyclingPanel } from "@/components/calendar/RecyclingPanel";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { tab: rawTab, month } = await searchParams;
  const tab =
    rawTab === "queue" ? "queue" : rawTab === "recycle" ? "recycle" : "calendar";

  const now = new Date();
  const monthISO =
    month && /^\d{4}-\d{2}-01$/.test(month)
      ? month
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthStart = new Date(`${monthISO}T00:00:00`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const brandId = brandScope(await getActiveBrandId());
  const [posts, queue, recycling] = await Promise.all([
    getCalendarPosts(monthStart, monthEnd, brandId),
    getQueueRows(brandId),
    getRecyclingOverview(brandId),
  ]);

  const attention = queue.filter((q) =>
    ["failed", "manual_required"].includes(q.status),
  ).length;

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Calendar
          </h1>
          <p className="mt-0.5 text-xs text-muted md:text-sm">
            Scheduled and published posts across every account
          </p>
        </div>
        <Link
          href="/composer"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          + New post
        </Link>
      </div>

      <div className="flex rounded-xl border border-border bg-surface-2 p-0.5">
        {(
          [
            ["calendar", "Calendar"],
            ["queue", `Queue${attention ? ` (${attention})` : ""}`],
            ["recycle", "Recycling"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/calendar?tab=${key}`}
            className={cn(
              "flex-1 rounded-[10px] px-3 py-2 text-center text-sm font-medium transition",
              tab === key ? "bg-accent text-white" : "text-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "calendar" ? (
        <CalendarClient posts={posts} monthISO={monthISO} />
      ) : tab === "queue" ? (
        <QueueTable rows={queue} />
      ) : (
        <RecyclingPanel rows={recycling} />
      )}
    </div>
  );
}
