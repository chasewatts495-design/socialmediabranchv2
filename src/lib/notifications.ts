import { and, desc, gt, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { activityLog } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";

/**
 * The notifications feed: interesting activity_log events translated to
 * plain English. Routine noise (daily syncs, cron ticks, seeds) stays
 * out — this is "things the owner would want to know happened".
 */

const INTERESTING = [
  "post.published",
  "post.failed",
  "post.skipped_permission",
  "post.manual_required",
  "recycle.scheduled",
  "recycle.enabled",
  "recycle.disabled",
  "account.connected_oauth",
  "account.disconnected",
  "account.added",
  "account.removed",
  "oauth.callback_failed",
  "job.failed",
  "sync.failed",
  "brand.created",
  "brand.deleted",
  "credentials.saved",
  "trend.scan.completed",
] as const;

const LABELS: Record<string, string> = {
  "post.published": "Post published",
  "post.failed": "A post failed to publish",
  "post.skipped_permission": "Post skipped — posting is off for that account",
  "post.manual_required": "Manual step: post it in the app, then mark done",
  "recycle.scheduled": "Recycled a post onto the calendar",
  "recycle.enabled": "Recycling turned on",
  "recycle.disabled": "Recycling turned off",
  "account.connected_oauth": "Account connected — it's live",
  "account.disconnected": "Account disconnected (tokens deleted)",
  "account.added": "Account added",
  "account.removed": "Account removed",
  "oauth.callback_failed": "A connection attempt failed",
  "job.failed": "A background job gave up after retries",
  "sync.failed": "A stats sync failed",
  "brand.created": "Brand created",
  "brand.deleted": "Brand deleted",
  "credentials.saved": "Credentials saved (encrypted)",
  "trend.scan.completed": "Trend Radar found fresh signals",
};

export interface NotificationItem {
  id: string;
  ts: string; // ISO
  level: string;
  title: string;
  detail: string | null;
  href: string | null;
  unread: boolean;
}

export interface NotificationsData {
  items: NotificationItem[];
  unreadCount: number;
}

function detailText(detail: Record<string, unknown> | null): string | null {
  if (!detail) return null;
  const interesting =
    (typeof detail.handle === "string" && detail.handle) ||
    (typeof detail.name === "string" && detail.name) ||
    (typeof detail.message === "string" && detail.message) ||
    (typeof detail.url === "string" && detail.url);
  return interesting ? String(interesting).slice(0, 120) : null;
}

export async function getNotifications(limit = 20): Promise<NotificationsData> {
  const db = await getDb();
  const readAtRaw = await getSetting("notifications.readAt");
  const readAt = readAtRaw ? new Date(readAtRaw) : new Date(0);

  const rows = await db
    .select()
    .from(activityLog)
    .where(inArray(activityLog.event, [...INTERESTING]))
    .orderBy(desc(activityLog.ts))
    .limit(limit);

  // Bounded count — the badge shows "99+" past this window anyway.
  const unreadCount = (
    await db
      .select({ id: activityLog.id })
      .from(activityLog)
      .where(
        and(
          inArray(activityLog.event, [...INTERESTING]),
          gt(activityLog.ts, readAt),
        ),
      )
      .limit(100)
  ).length;

  return {
    items: rows.map((r) => ({
      id: r.id,
      ts: r.ts.toISOString(),
      level: r.level,
      title: LABELS[r.event] ?? r.event,
      detail: detailText(r.detail),
      href:
        r.event === "trend.scan.completed"
          ? "/trends"
          : r.postId
            ? "/calendar?tab=queue"
            : r.accountId
              ? `/accounts/${r.accountId}`
              : null,
      unread: r.ts > readAt,
    })),
    unreadCount,
  };
}
