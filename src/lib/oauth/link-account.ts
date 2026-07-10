import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  accounts,
  activityLog,
  credentials,
  scheduleJobs,
} from "@/lib/db/schema";
import { encryptSecret } from "@/lib/crypto/secretbox";
import { PLATFORM_BADGE_COLORS } from "@/lib/metrics/colors";
import type { DiscoveredAccount } from "./types";

const uuid = () => crypto.randomUUID();

/**
 * Turns a discovered OAuth account into a live Branch account: reuses the
 * existing row when the same external account was connected before (or a
 * reauth was requested), stores the encrypted token payload, and queues
 * an immediate 90-day stats backfill.
 */
export async function linkDiscoveredAccount(
  db: Db,
  found: DiscoveredAccount,
  opts: { brandId: string | null; reauthAccountId?: string },
): Promise<string> {
  let accountId = opts.reauthAccountId ?? null;

  if (!accountId) {
    // Same platform + same external id ⇒ same account (externalId lives in
    // the encrypted payload, so match on the stable handle instead).
    const existing = await db.query.accounts.findFirst({
      where: (a, { and: and_, eq: eq_ }) =>
        and_(eq_(a.platformId, found.platformId), eq_(a.handle, found.handle)),
    });
    accountId = existing?.id ?? null;
  }

  if (accountId) {
    await db
      .update(accounts)
      .set({
        mode: "live",
        status: "connected",
        syncError: null,
        handle: found.handle,
        displayName: found.displayName,
        ...(opts.brandId ? { brandId: opts.brandId } : {}),
      })
      .where(eq(accounts.id, accountId));
  } else {
    accountId = uuid();
    const count = (await db.select({ id: accounts.id }).from(accounts)).length;
    await db.insert(accounts).values({
      id: accountId,
      platformId: found.platformId,
      brandId: opts.brandId,
      handle: found.handle,
      displayName: found.displayName,
      avatarColor: PLATFORM_BADGE_COLORS[found.platformId],
      mode: "live",
      status: "connected",
      sortOrder: count,
    });
  }

  const payload = {
    ...found.credentialPayload,
    externalId: found.externalId,
  };
  await db
    .insert(credentials)
    .values({
      id: uuid(),
      accountId,
      authKind: "oauth2",
      encryptedPayload: encryptSecret(JSON.stringify(payload)),
      scopes: found.scopes,
      expiresAt: found.expiresAt ? new Date(found.expiresAt) : null,
    })
    .onConflictDoUpdate({
      target: credentials.accountId,
      set: {
        authKind: "oauth2",
        encryptedPayload: encryptSecret(JSON.stringify(payload)),
        scopes: found.scopes,
        expiresAt: found.expiresAt ? new Date(found.expiresAt) : null,
        updatedAt: new Date(),
      },
    });

  // 90-day history backfill, picked up by the next tick (dev ticker or cron).
  await db.insert(scheduleJobs).values({
    id: uuid(),
    kind: "sync_stats",
    refId: accountId,
    runAt: new Date(),
  });
  await db.insert(activityLog).values({
    id: uuid(),
    event: "account.connected_oauth",
    accountId,
    detail: { platformId: found.platformId, handle: found.handle },
  });
  return accountId;
}
