"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { accounts, activityLog, credentials, scheduleJobs } from "@/lib/db/schema";
import {
  PLATFORM_DEFS,
  capabilitiesFor,
  resolveConnector,
} from "@/lib/connectors/registry";
import "@/lib/connectors/live/register";
import { PLATFORM_IDS, type PlatformId } from "@/lib/connectors/types";
import { encryptSecret } from "@/lib/crypto/secretbox";
import { PLATFORM_BADGE_COLORS } from "@/lib/metrics/colors";
import { syncAccount, contextFor } from "@/lib/scheduler/jobs";
import { brandScope, getActiveBrandId } from "@/lib/brands";
import type { ActionResult } from "./accounts";

const uuid = () => crypto.randomUUID();

const addSchema = z.object({
  platformId: z.enum(PLATFORM_IDS),
  handle: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120),
});

export async function addAccountAction(
  platformId: PlatformId,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = addSchema.safeParse({
    platformId,
    handle: String(formData.get("handle") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: "Fill in both fields." };
  }
  const db = await getDb();
  const caps = capabilitiesFor(platformId);
  const mode = caps.canPublish ? "demo" : "manual";
  const accountId = uuid();

  const existingCount = (await db.select({ id: accounts.id }).from(accounts)).length;
  // New accounts join whichever brand is active ("All brands" → no brand yet,
  // assignable later from the brand manager).
  const brandId = brandScope(await getActiveBrandId()) ?? null;
  await db.insert(accounts).values({
    id: accountId,
    platformId,
    brandId,
    handle: parsed.data.handle,
    displayName: parsed.data.displayName,
    avatarColor: PLATFORM_BADGE_COLORS[platformId],
    mode,
    sortOrder: existingCount,
  });

  // Demo accounts get instant 90-day history so charts work immediately.
  if (mode === "demo") {
    await syncAccount(db, accountId, { sinceDays: 90 });
  }
  // Daily stats sync from tomorrow 06:00 UTC.
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(6, 0, 0, 0);
  await db.insert(scheduleJobs).values({
    id: uuid(),
    kind: "sync_stats",
    refId: accountId,
    runAt: next,
  });
  await db.insert(activityLog).values({
    id: uuid(),
    event: "account.added",
    accountId,
    detail: { platformId, handle: parsed.data.handle, mode },
  });

  revalidatePath("/connections");
  revalidatePath(`/connections/${platformId}`);
  revalidatePath("/");
  return {
    ok: true,
    message:
      mode === "manual"
        ? `${parsed.data.handle} added in manual mode — record stats from the app's own insights.`
        : `${parsed.data.handle} added with demo data — paste API credentials below when you have them.`,
  };
}

export async function saveCredentialsAction(
  accountId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const db = await getDb();
  const account = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
  });
  if (!account) return { ok: false, message: "Account not found." };

  const caps = capabilitiesFor(account.platformId as PlatformId);
  const payload: Record<string, string> = {};
  const missing: string[] = [];
  for (const field of caps.auth.credentialFields) {
    const v = String(formData.get(field.key) ?? "").trim();
    if (!v) missing.push(field.label);
    else payload[field.key] = v;
  }
  if (missing.length) {
    return { ok: false, message: `Missing: ${missing.join(", ")}` };
  }

  await db
    .insert(credentials)
    .values({
      id: uuid(),
      accountId,
      authKind: caps.auth.kind,
      encryptedPayload: encryptSecret(JSON.stringify(payload)),
    })
    .onConflictDoUpdate({
      target: credentials.accountId,
      set: {
        authKind: caps.auth.kind,
        encryptedPayload: encryptSecret(JSON.stringify(payload)),
        updatedAt: new Date(),
      },
    });
  await db.insert(activityLog).values({
    id: uuid(),
    event: "credentials.saved",
    accountId,
    detail: { fields: Object.keys(payload).length },
  });

  // If a live connector exists (Reddit script apps), verify the keys right
  // now and flip the account live on success.
  const def = PLATFORM_DEFS[account.platformId as PlatformId];
  if (def.buildLiveConnector) {
    const liveTest = await def
      .buildLiveConnector()
      .testConnection(
        contextFor(db, { ...account, mode: "live" }),
      )
      .catch((err) => ({
        ok: false as const,
        message: err instanceof Error ? err.message : "Connection failed.",
      }));
    if (liveTest.ok) {
      await db
        .update(accounts)
        .set({ mode: "live", status: "connected", syncError: null })
        .where(eq(accounts.id, accountId));
      await db.insert(scheduleJobs).values({
        id: uuid(),
        kind: "sync_stats",
        refId: accountId,
        runAt: new Date(),
      });
      revalidatePath(`/connections/${account.platformId}`);
      revalidatePath("/");
      return {
        ok: true,
        message: `LIVE ✓ ${liveTest.message ?? "Connection verified."} Posts from Branch now publish for real.`,
      };
    }
    revalidatePath(`/connections/${account.platformId}`);
    return {
      ok: false,
      message: `Credentials stored (encrypted), but the live check failed: ${liveTest.message ?? "unknown error"} The account stays in demo mode until it passes.`,
    };
  }

  revalidatePath(`/connections/${account.platformId}`);
  return {
    ok: true,
    message:
      "Credentials stored (AES-256 encrypted). This platform connects with the Connect button (or ships live in a later phase) — demo mode keeps working meanwhile.",
  };
}

export async function testConnectionAction(accountId: string): Promise<ActionResult> {
  const db = await getDb();
  const account = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
  });
  if (!account) return { ok: false, message: "Account not found." };
  try {
    const connector = resolveConnector({
      platformId: account.platformId as PlatformId,
      mode: account.mode as "demo" | "live" | "manual",
    });
    const res = await connector.testConnection(contextFor(db, account));
    return { ok: res.ok, message: res.message ?? (res.ok ? "Connection OK." : "Failed.") };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteAccountAction(accountId: string): Promise<void> {
  const db = await getDb();
  const account = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
  });
  if (!account) return;
  await db.delete(accounts).where(eq(accounts.id, accountId));
  await db.insert(activityLog).values({
    id: uuid(),
    event: "account.removed",
    detail: { handle: account.handle, platformId: account.platformId },
  });
  revalidatePath("/connections");
  revalidatePath(`/connections/${account.platformId}`);
  revalidatePath("/");
}
