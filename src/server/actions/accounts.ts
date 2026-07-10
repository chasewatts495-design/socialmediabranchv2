"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { accounts, activityLog, metricSnapshots } from "@/lib/db/schema";
import { syncAccount } from "@/lib/scheduler/jobs";

const uuid = () => crypto.randomUUID();

/** Per-account permission switches: what Branch may do with this account. */
export async function setAccountPermissionAction(
  accountId: string,
  permission: "posting" | "sync",
  enabled: boolean,
): Promise<void> {
  const db = await getDb();
  await db
    .update(accounts)
    .set(
      permission === "posting"
        ? { postingEnabled: enabled }
        : { syncEnabled: enabled },
    )
    .where(eq(accounts.id, accountId));
  await db.insert(activityLog).values({
    id: uuid(),
    event: `account.permission.${permission}_${enabled ? "on" : "off"}`,
    accountId,
  });
  revalidatePath("/", "layout");
}

export async function syncNowAction(accountId: string): Promise<void> {
  const db = await getDb();
  await syncAccount(db, accountId, { sinceDays: 7 });
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/");
}

const manualStatSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  followers: z.coerce.number().int().nonnegative().optional(),
  impressions: z.coerce.number().int().nonnegative().optional(),
  reach: z.coerce.number().int().nonnegative().optional(),
  engagements: z.coerce.number().int().nonnegative().optional(),
  likes: z.coerce.number().int().nonnegative().optional(),
  comments: z.coerce.number().int().nonnegative().optional(),
  shares: z.coerce.number().int().nonnegative().optional(),
  videoViews: z.coerce.number().int().nonnegative().optional(),
});

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function addManualStatAction(
  accountId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw: Record<string, string> = {};
  for (const key of Object.keys(manualStatSchema.shape)) {
    const v = formData.get(key);
    if (typeof v === "string" && v.trim() !== "") raw[key] = v.trim();
  }
  const parsed = manualStatSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  const d = parsed.data;
  const db = await getDb();
  await db
    .insert(metricSnapshots)
    .values({
      id: uuid(),
      accountId,
      date: d.date,
      followers: d.followers,
      impressions: d.impressions,
      reach: d.reach,
      engagements: d.engagements,
      likes: d.likes,
      comments: d.comments,
      shares: d.shares,
      videoViews: d.videoViews,
      source: "manual",
    })
    .onConflictDoUpdate({
      target: [metricSnapshots.accountId, metricSnapshots.date],
      set: {
        followers: d.followers,
        impressions: d.impressions,
        reach: d.reach,
        engagements: d.engagements,
        likes: d.likes,
        comments: d.comments,
        shares: d.shares,
        videoViews: d.videoViews,
        source: "manual",
      },
    });
  await db.insert(activityLog).values({
    id: uuid(),
    event: "stats.manual_entry",
    accountId,
    detail: { date: d.date },
  });
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/");
  return { ok: true, message: `Saved stats for ${d.date}.` };
}
