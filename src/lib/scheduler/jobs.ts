import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  accounts,
  activityLog,
  credentials,
  metricSnapshots,
  postTargets,
} from "@/lib/db/schema";
import { resolveConnector } from "@/lib/connectors/registry";
import "@/lib/connectors/live/register";
import type {
  Connector,
  ConnectorContext,
  PlatformId,
} from "@/lib/connectors/types";
import { daysAgo } from "@/lib/connectors/demo/generators";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secretbox";

const uuid = () => crypto.randomUUID();

export function contextFor(
  db: Db,
  account: {
    id: string;
    platformId: string;
    handle: string;
    mode: string;
  },
): ConnectorContext {
  return {
    account: {
      id: account.id,
      platformId: account.platformId as PlatformId,
      handle: account.handle,
      mode: account.mode as "demo" | "live" | "manual",
    },
    async getCredentials<T = Record<string, string>>() {
      const row = await db.query.credentials.findFirst({
        where: (c, { eq: eq2 }) => eq2(c.accountId, account.id),
      });
      if (!row) return null;
      try {
        return JSON.parse(decryptSecret(row.encryptedPayload)) as T;
      } catch {
        return null;
      }
    },
    async saveCredentials(payload, opts) {
      await db
        .update(credentials)
        .set({
          encryptedPayload: encryptSecret(JSON.stringify(payload)),
          ...(opts && "expiresAt" in opts ? { expiresAt: opts.expiresAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(credentials.accountId, account.id));
    },
    async log(event, detail) {
      await db.insert(activityLog).values({
        id: uuid(),
        event,
        accountId: account.id,
        detail: detail ?? {},
      });
    },
  };
}

/**
 * Pulls fresh daily stats through the account's connector and upserts
 * metric_snapshots. Used by the "Sync now" button and the daily sync job.
 */
export async function syncAccount(
  db: Db,
  accountId: string,
  opts: { sinceDays?: number } = {},
): Promise<{ ok: boolean; upserted: number; message?: string }> {
  const account = await db.query.accounts.findFirst({
    where: (a, { eq: eq2 }) => eq2(a.id, accountId),
  });
  if (!account) return { ok: false, upserted: 0, message: "Account not found" };

  if (!account.syncEnabled) {
    return {
      ok: true,
      upserted: 0,
      message: "Sync is turned off for this account.",
    };
  }

  const connector = resolveConnector({
    platformId: account.platformId as PlatformId,
    mode: account.mode as "demo" | "live" | "manual",
  });

  if (!connector.capabilities.canFetchAccountStats && account.mode !== "demo") {
    // Live platforms without account-level stats (Reddit) still sync
    // per-post metrics; manual accounts record stats by hand.
    if (account.mode === "live" && connector.capabilities.canFetchPostStats) {
      try {
        const updated = await syncPostMetricsForAccount(db, account, connector);
        await db
          .update(accounts)
          .set({ lastSyncAt: new Date(), syncError: null, status: "connected" })
          .where(eq(accounts.id, accountId));
        return {
          ok: true,
          upserted: updated,
          message: `No account-level stats API here — refreshed per-post stats on ${updated} post${updated === 1 ? "" : "s"} instead.`,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(accounts)
          .set({ syncError: message, status: "error" })
          .where(eq(accounts.id, accountId));
        return { ok: false, upserted: 0, message };
      }
    }
    await db
      .update(accounts)
      .set({ lastSyncAt: new Date(), syncError: null })
      .where(eq(accounts.id, accountId));
    return {
      ok: true,
      upserted: 0,
      message: "Manual account — add stats yourself or import a CSV.",
    };
  }

  try {
    const since = daysAgo(opts.sinceDays ?? 7);
    const rows = await connector.fetchAccountStats(contextFor(db, account), {
      sinceDate: since,
    });
    for (const s of rows) {
      await db
        .insert(metricSnapshots)
        .values({
          id: uuid(),
          accountId,
          date: s.date,
          followers: s.followers,
          following: s.following,
          postCount: s.postCount,
          impressions: s.impressions,
          reach: s.reach,
          profileViews: s.profileViews,
          engagements: s.engagements,
          likes: s.likes,
          comments: s.comments,
          shares: s.shares,
          saves: s.saves,
          videoViews: s.videoViews,
          watchTimeSec: s.watchTimeSec,
          source: account.mode === "live" ? "api" : "demo",
        })
        .onConflictDoUpdate({
          target: [metricSnapshots.accountId, metricSnapshots.date],
          set: {
            followers: s.followers,
            following: s.following,
            postCount: s.postCount,
            impressions: s.impressions,
            reach: s.reach,
            profileViews: s.profileViews,
            engagements: s.engagements,
            likes: s.likes,
            comments: s.comments,
            shares: s.shares,
            saves: s.saves,
            videoViews: s.videoViews,
            watchTimeSec: s.watchTimeSec,
          },
        });
    }
    // Live accounts also refresh per-post metrics (matched by external id).
    if (account.mode === "live" && connector.capabilities.canFetchPostStats) {
      try {
        await syncPostMetricsForAccount(db, account, connector);
      } catch {
        // Post metrics are best-effort — account stats already landed.
      }
    }

    await db
      .update(accounts)
      .set({ lastSyncAt: new Date(), syncError: null, status: "connected" })
      .where(eq(accounts.id, accountId));
    await db.insert(activityLog).values({
      id: uuid(),
      event: "sync.completed",
      accountId,
      detail: { rows: rows.length },
    });
    return { ok: true, upserted: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(accounts)
      .set({ syncError: message, status: "error" })
      .where(eq(accounts.id, accountId));
    await db.insert(activityLog).values({
      id: uuid(),
      event: "sync.failed",
      level: "error",
      accountId,
      detail: { message },
    });
    return { ok: false, upserted: 0, message };
  }
}

/**
 * Pulls the platform's own numbers for recent posts and writes them onto
 * matching post_targets (matched by externalPostId). Returns how many
 * targets got fresh metrics.
 */
async function syncPostMetricsForAccount(
  db: Db,
  account: { id: string; platformId: string; handle: string; mode: string },
  connector: Connector,
): Promise<number> {
  const recent = await connector.fetchRecentPosts(contextFor(db, account), {
    limit: 25,
  });
  let updated = 0;
  for (const post of recent) {
    const m = post.metrics;
    const interactions =
      (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
    const engagementRate =
      m.impressions && m.impressions > 0
        ? Math.round((interactions / m.impressions) * 1000) / 10
        : undefined;
    const rows = await db
      .update(postTargets)
      .set({
        metrics: {
          impressions: m.impressions,
          likes: m.likes,
          comments: m.comments,
          shares: m.shares,
          saves: m.saves,
          videoViews: m.videoViews,
          engagementRate,
        },
        metricsSyncedAt: new Date(),
      })
      .where(
        and(
          eq(postTargets.accountId, account.id),
          eq(postTargets.externalPostId, post.externalId),
        ),
      )
      .returning({ id: postTargets.id });
    updated += rows.length;
  }
  return updated;
}
