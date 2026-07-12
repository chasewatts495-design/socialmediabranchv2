import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { activityLog, scheduleJobs } from "@/lib/db/schema";
import { publishPostNow } from "@/lib/posts/publish";
import { syncAccount } from "./jobs";

const uuid = () => crypto.randomUUID();

const BACKOFF_MINUTES = [1, 5, 15];
const STALE_LOCK_MINUTES = 5;
const DEFAULT_BATCH = 10;

type JobRow = typeof scheduleJobs.$inferSelect;

/**
 * Atomically claims due jobs. FOR UPDATE SKIP LOCKED makes concurrent ticks
 * (overlapping cron + external pinger) safe — each job runs exactly once.
 */
async function claimDueJobs(db: Db, limit: number): Promise<JobRow[]> {
  const res = await db.execute<JobRow>(sql`
    UPDATE schedule_jobs SET status = 'running', locked_at = now()
    WHERE id IN (
      SELECT id FROM schedule_jobs
      WHERE status = 'pending' AND run_at <= now()
      ORDER BY run_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  // execute() returns snake_case columns — normalize.
  return res.rows.map((r) => {
    const row = r as unknown as Record<string, unknown>;
    return {
      id: row.id,
      kind: row.kind,
      refId: row.ref_id,
      runAt: new Date(row.run_at as string),
      status: row.status,
      attemptCount: Number(row.attempt_count),
      maxAttempts: Number(row.max_attempts),
      lastError: row.last_error,
      lockedAt: row.locked_at ? new Date(row.locked_at as string) : null,
      createdAt: new Date(row.created_at as string),
    } as JobRow;
  });
}

/** Requeues jobs whose worker died mid-run (stale lock). */
async function reapStaleLocks(db: Db): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_LOCK_MINUTES * 60_000);
  const rows = await db
    .update(scheduleJobs)
    .set({ status: "pending", lockedAt: null })
    .where(
      and(eq(scheduleJobs.status, "running"), lt(scheduleJobs.lockedAt, cutoff)),
    )
    .returning({ id: scheduleJobs.id });
  return rows.length;
}

async function executeJob(db: Db, job: JobRow): Promise<void> {
  switch (job.kind) {
    case "publish_post": {
      await publishPostNow(db, job.refId);
      return;
    }
    case "sync_stats": {
      // A live account with no API-sourced history yet is a fresh
      // connection — its first sync is the promised 90-day backfill.
      const account = await db.query.accounts.findFirst({
        where: (a, { eq: e }) => e(a.id, job.refId),
      });
      let sinceDays = 3;
      if (account?.mode === "live") {
        const { metricSnapshots } = await import("@/lib/db/schema");
        const apiRows = await db
          .select({ id: metricSnapshots.id })
          .from(metricSnapshots)
          .where(
            and(
              eq(metricSnapshots.accountId, job.refId),
              eq(metricSnapshots.source, "api"),
            ),
          )
          .limit(1);
        if (apiRows.length === 0) sinceDays = 90;
      }
      const result = await syncAccount(db, job.refId, { sinceDays });
      if (!result.ok) throw new Error(result.message ?? "sync failed");
      // Self-reschedule tomorrow 06:00 UTC.
      const next = new Date();
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(6, 0, 0, 0);
      await db.insert(scheduleJobs).values({
        id: uuid(),
        kind: "sync_stats",
        refId: job.refId,
        runAt: next,
      });
      return;
    }
    case "ai_report": {
      const { runAiReportJob } = await import("@/lib/ai/run-report");
      await runAiReportJob(db, job.refId);
      return;
    }
    case "recycle_pick": {
      const { runRecyclePick } = await import("@/lib/recycle");
      const result = await runRecyclePick(db, job.refId);
      if (!result.ok) throw new Error(result.message);
      // Self-reschedule on the rule's cadence while it stays enabled.
      const rule = await db.query.recycleRules.findFirst({
        where: (r, { eq: e }) => e(r.accountId, job.refId),
      });
      if (rule?.enabled) {
        await db.insert(scheduleJobs).values({
          id: uuid(),
          kind: "recycle_pick",
          refId: job.refId,
          runAt: new Date(Date.now() + rule.everyHours * 3_600_000),
        });
      }
      return;
    }
    case "trend_scan": {
      // refId = "<brandId|all>:<keyword>" — a pinned keyword's daily rescan.
      const sep = job.refId.indexOf(":");
      const brandId = job.refId.slice(0, sep);
      const keyword = job.refId.slice(sep + 1);
      if (!keyword) return;
      await import("@/lib/trends/sources/register");
      const { runTrendScan } = await import("@/lib/trends/run");
      const { trendScans } = await import("@/lib/db/schema");
      const scanId = uuid();
      await db.insert(trendScans).values({
        id: scanId,
        brandId: brandId === "all" ? null : brandId,
        keyword,
        platforms: [],
      });
      await runTrendScan(db, scanId);
      // Keep scanning daily while the keyword stays pinned.
      const { getSetting } = await import("@/lib/settings");
      const raw = await getSetting(`trends.keywords.${brandId}`);
      const pinned: string[] = raw ? JSON.parse(raw) : [];
      if (pinned.includes(keyword)) {
        await db.insert(scheduleJobs).values({
          id: uuid(),
          kind: "trend_scan",
          refId: job.refId,
          runAt: new Date(Date.now() + 24 * 3_600_000),
        });
      }
      return;
    }
    default:
      throw new Error(`Unknown job kind: ${job.kind}`);
  }
}

export interface TickResult {
  claimed: number;
  done: number;
  failed: number;
  retried: number;
  reaped: number;
}

/** One bounded pass over due work. Idempotent; safe to call concurrently. */
export async function runDueWork(
  db: Db,
  opts: { limit?: number } = {},
): Promise<TickResult> {
  const reaped = await reapStaleLocks(db);
  const jobs = await claimDueJobs(db, opts.limit ?? DEFAULT_BATCH);
  let done = 0;
  let failed = 0;
  let retried = 0;

  for (const job of jobs) {
    try {
      await executeJob(db, job);
      await db
        .update(scheduleJobs)
        .set({ status: "done", lockedAt: null })
        .where(eq(scheduleJobs.id, job.id));
      done++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = job.attemptCount + 1;
      if (attempts >= job.maxAttempts) {
        await db
          .update(scheduleJobs)
          .set({
            status: "failed",
            attemptCount: attempts,
            lastError: message,
            lockedAt: null,
          })
          .where(eq(scheduleJobs.id, job.id));
        await db.insert(activityLog).values({
          id: uuid(),
          event: "job.failed",
          level: "error",
          detail: { jobId: job.id, kind: job.kind, refId: job.refId, message },
        });
        failed++;
      } else {
        const backoff =
          BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
        await db
          .update(scheduleJobs)
          .set({
            status: "pending",
            attemptCount: attempts,
            lastError: message,
            lockedAt: null,
            runAt: new Date(Date.now() + backoff * 60_000),
          })
          .where(eq(scheduleJobs.id, job.id));
        retried++;
      }
    }
  }

  if (jobs.length > 0) {
    await db.insert(activityLog).values({
      id: uuid(),
      event: "tick.completed",
      detail: { claimed: jobs.length, done, failed, retried, reaped },
    });
  }
  return { claimed: jobs.length, done, failed, retried, reaped };
}
