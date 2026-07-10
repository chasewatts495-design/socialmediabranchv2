"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/db/client";
import { aiReports, posts, postTargets } from "@/lib/db/schema";
import { runAiReportJob } from "@/lib/ai/run-report";
import { REPORT_TYPES, type ContentPlan, type ReportType } from "@/lib/ai/contracts";
import { adaptCaption } from "@/lib/posts/variants";
import { deleteSetting, getSetting, setSetting } from "@/lib/settings";
import { friendlyAiError, getAiModel } from "@/lib/ai/client";
import type { ActionResult } from "./accounts";
import type { PlatformId } from "@/lib/connectors/types";

const uuid = () => crypto.randomUUID();

const startSchema = z.object({
  type: z.enum(Object.keys(REPORT_TYPES) as [ReportType, ...ReportType[]]),
  params: z.record(z.string(), z.unknown()).default({}),
});

export async function startReportAction(input: {
  type: ReportType;
  params?: Record<string, unknown>;
}): Promise<{ ok: boolean; reportId?: string; message?: string }> {
  const parsed = startSchema.safeParse({ type: input.type, params: input.params ?? {} });
  if (!parsed.success) return { ok: false, message: "Invalid report request." };

  const db = await getDb();
  const reportId = uuid();
  await db.insert(aiReports).values({
    id: reportId,
    type: parsed.data.type,
    params: parsed.data.params,
  });
  // Runs inline — generation takes seconds, and the result is fresh on refresh.
  await runAiReportJob(db, reportId);
  revalidatePath("/strategist");
  return { ok: true, reportId };
}

/** Turns a ContentPlan report into draft posts on the calendar. */
export async function applyPlanAction(reportId: string): Promise<ActionResult> {
  const db = await getDb();
  const report = await db.query.aiReports.findFirst({
    where: (r, { eq }) => eq(r.id, reportId),
  });
  if (!report || report.type !== "content_plan" || report.status !== "complete") {
    return { ok: false, message: "Content plan not found or incomplete." };
  }
  const plan = report.result as unknown as ContentPlan;
  if (!plan?.items?.length) return { ok: false, message: "Plan has no items." };

  const accounts = await db.query.accounts.findMany();
  let created = 0;

  for (const item of plan.items) {
    const targetsForItem = accounts.filter((a) =>
      item.platforms.includes(a.platformId as PlatformId),
    );
    if (targetsForItem.length === 0) continue;

    const caption = `${item.draftCaption}${item.hashtags.length ? `\n\n${item.hashtags.join(" ")}` : ""}`;
    const scheduledAt = new Date(`${item.date}T${item.timeLocal || "12:00"}:00Z`);
    const postId = uuid();
    await db.insert(posts).values({
      id: postId,
      caption,
      status: "draft",
      scheduledAt: Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt,
      aiGenerated: true,
      sourceReportId: reportId,
    });
    for (const account of targetsForItem) {
      const variant = adaptCaption(account.platformId as PlatformId, caption, {
        accountHandle: account.handle,
      });
      await db.insert(postTargets).values({
        id: uuid(),
        postId,
        accountId: account.id,
        variantCaption: variant.caption,
        variantMeta: variant.meta,
        status: "pending",
      });
    }
    created++;
  }

  revalidatePath("/library");
  revalidatePath("/calendar");
  revalidatePath("/strategist");
  return {
    ok: true,
    message: `Created ${created} draft post${created === 1 ? "" : "s"} — review them in Library → Drafts, then schedule or publish.`,
  };
}

/* ── Anthropic key management (Settings) ───────────────────────────────── */

export async function saveAnthropicKeyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const key = String(formData.get("apiKey") ?? "").trim();
  if (!key) return { ok: false, message: "Paste a key first." };
  if (!key.startsWith("sk-ant-")) {
    return { ok: false, message: "That doesn't look like an Anthropic API key (sk-ant-…)." };
  }
  await setSetting("anthropic.apiKey", key, { encrypted: true });
  revalidatePath("/settings");
  revalidatePath("/strategist");
  return { ok: true, message: "Key saved (encrypted). Run 'Test key' to verify." };
}

export async function deleteAnthropicKeyAction(): Promise<void> {
  await deleteSetting("anthropic.apiKey");
  revalidatePath("/settings");
  revalidatePath("/strategist");
}

export async function testAnthropicKeyAction(): Promise<ActionResult> {
  const key = await getSetting("anthropic.apiKey");
  if (!key) return { ok: false, message: "No key saved yet." };
  try {
    const client = new Anthropic({ apiKey: key });
    const model = await getAiModel();
    const info = await client.models.retrieve(model);
    return { ok: true, message: `Key works — ${info.display_name} is available.` };
  } catch (err) {
    return { ok: false, message: friendlyAiError(err) };
  }
}

export async function setAiModelAction(model: string): Promise<void> {
  await setSetting("ai.model", model);
  revalidatePath("/settings");
}
