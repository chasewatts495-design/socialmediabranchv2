import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  accounts,
  activityLog,
  credentials,
  scheduleJobs,
} from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secretbox";
import { PLATFORM_BADGE_COLORS } from "@/lib/metrics/colors";
import type { DiscoveredAccount } from "./types";

const uuid = () => crypto.randomUUID();

/**
 * Turns a discovered OAuth account into a live Branch account: reuses the
 * existing row when the SAME external identity was connected before,
 * stores the encrypted token payload, and queues an immediate 90-day
 * stats backfill.
 *
 * Identity is the platform's external id (stored inside the encrypted
 * payload), never the display handle — two Facebook Pages can share a
 * name, and merging them would hijack each other's history and tokens.
 * A handle match is only trusted for accounts with no credentials at all
 * (the demo-placeholder upgrade path). A reauth request is honored only
 * when the login comes back as the same identity.
 */
export async function linkDiscoveredAccount(
  db: Db,
  found: DiscoveredAccount,
  opts: { brandId: string | null; reauthAccountId?: string },
): Promise<string> {
  const candidates = await db.query.accounts.findMany({
    where: (a, { eq: eq_ }) => eq_(a.platformId, found.platformId),
    with: { credential: true },
  });

  const externalIdOf = (row: (typeof candidates)[number]): string | null => {
    if (!row.credential) return null;
    try {
      const payload = JSON.parse(
        decryptSecret(row.credential.encryptedPayload),
      ) as { externalId?: unknown };
      return typeof payload.externalId === "string" ? payload.externalId : null;
    } catch {
      return null;
    }
  };

  let accountId: string | null =
    candidates.find((c) => externalIdOf(c) === found.externalId)?.id ?? null;

  if (!accountId && opts.reauthAccountId) {
    // Reauth only rebinds when the identity matches (or the target row
    // has no identity on file yet) — a different login must not steal
    // another account's history.
    const target = candidates.find((c) => c.id === opts.reauthAccountId);
    if (target) {
      const stored = externalIdOf(target);
      if (stored === null || stored === found.externalId) {
        accountId = target.id;
      }
    }
  }

  if (!accountId) {
    // Credential-less placeholder with the same handle → upgrade it.
    const placeholder = candidates.find(
      (c) => !c.credential && c.handle === found.handle,
    );
    accountId = placeholder?.id ?? null;
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
