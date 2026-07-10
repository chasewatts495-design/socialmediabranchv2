"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { activityLog, recycleRules } from "@/lib/db/schema";
import {
  cancelRecycleJobs,
  ensureRecycleJob,
  runRecyclePick,
} from "@/lib/recycle";
import type { ActionResult } from "./accounts";

const uuid = () => crypto.randomUUID();

const ruleSchema = z.object({
  enabled: z.boolean(),
  everyHours: z.coerce.number().int().min(1).max(24 * 30),
  noRepeatDays: z.coerce.number().int().min(1).max(365),
  windowStartHour: z.coerce.number().int().min(0).max(23),
  windowEndHour: z.coerce.number().int().min(1).max(24),
  freshenCaption: z.boolean(),
});

export type RecycleRuleInput = z.infer<typeof ruleSchema>;

export async function saveRecycleRuleAction(
  accountId: string,
  input: RecycleRuleInput,
): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the rule values." };
  const d = parsed.data;
  if (d.windowEndHour <= d.windowStartHour) {
    return { ok: false, message: "The posting window must end after it starts." };
  }

  const db = await getDb();
  const account = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
  });
  if (!account) return { ok: false, message: "Account not found." };

  await db
    .insert(recycleRules)
    .values({ id: uuid(), accountId, ...d })
    .onConflictDoUpdate({
      target: recycleRules.accountId,
      set: { ...d },
    });

  if (d.enabled) {
    await ensureRecycleJob(db, accountId);
  } else {
    await cancelRecycleJobs(db, accountId);
  }
  await db.insert(activityLog).values({
    id: uuid(),
    event: d.enabled ? "recycle.enabled" : "recycle.disabled",
    accountId,
    detail: { everyHours: d.everyHours, noRepeatDays: d.noRepeatDays },
  });
  revalidatePath("/calendar");
  return {
    ok: true,
    message: d.enabled
      ? `Recycling on — first pick runs in about a minute, then every ${d.everyHours}h.`
      : "Recycling off.",
  };
}

/** "Recycle one now" — runs a pick immediately, outside the cadence. */
export async function recycleNowAction(
  accountId: string,
): Promise<ActionResult> {
  const db = await getDb();
  const rule = await db.query.recycleRules.findFirst({
    where: (r, { eq: e }) => e(r.accountId, accountId),
  });
  if (!rule?.enabled) {
    return { ok: false, message: "Turn recycling on first." };
  }
  const result = await runRecyclePick(db, accountId);
  revalidatePath("/calendar");
  return { ok: result.ok, message: result.message };
}

export async function deleteRecycleRuleAction(
  accountId: string,
): Promise<void> {
  const db = await getDb();
  await cancelRecycleJobs(db, accountId);
  await db.delete(recycleRules).where(eq(recycleRules.accountId, accountId));
  revalidatePath("/calendar");
}
