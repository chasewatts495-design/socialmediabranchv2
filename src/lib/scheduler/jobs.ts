import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { accounts, activityLog, metricSnapshots } from "@/lib/db/schema";
import { resolveConnector } from "@/lib/connectors/registry";
import type { ConnectorContext, PlatformId } from "@/lib/connectors/types";
import { daysAgo } from "@/lib/connectors/demo/generators";
import { decryptSecret } from "@/lib/crypto/secretbox";

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

  const connector = resolveConnector({
    platformId: account.platformId as PlatformId,
    mode: account.mode as "demo" | "live" | "manual",
  });

  if (!connector.capabilities.canFetchAccountStats && account.mode !== "demo") {
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
