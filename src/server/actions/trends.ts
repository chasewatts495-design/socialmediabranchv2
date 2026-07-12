"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { scheduleJobs, trendScans } from "@/lib/db/schema";
import { ALL_BRANDS, getActiveBrandId } from "@/lib/brands";
import { getSetting, setSetting } from "@/lib/settings";
import { PLATFORM_IDS } from "@/lib/connectors/types";
import { runTrendScan } from "@/lib/trends/run";
import "@/lib/trends/sources/register";

const uuid = () => crypto.randomUUID();

const scanInput = z.object({
  keyword: z.string().trim().min(2).max(80),
  platformIds: z.array(z.enum(PLATFORM_IDS)).max(8).default([]),
});

export interface TrendScanResult {
  ok: boolean;
  scanId?: string;
  message?: string;
}

export async function runTrendScanAction(
  input: z.infer<typeof scanInput>,
): Promise<TrendScanResult> {
  const parsed = scanInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Give the radar a keyword (2–80 chars)." };
  }
  const db = await getDb();
  const brandId = await getActiveBrandId();
  const scanId = uuid();
  await db.insert(trendScans).values({
    id: scanId,
    brandId: brandId === ALL_BRANDS ? null : brandId,
    keyword: parsed.data.keyword.toLowerCase(),
    platforms: parsed.data.platformIds,
  });
  // Runs inline — sources are parallel with hard per-source timeouts, so
  // the action fits comfortably inside the page's maxDuration budget.
  await runTrendScan(db, scanId);
  revalidatePath("/trends");
  revalidatePath("/");
  return { ok: true, scanId };
}

export async function deleteScanAction(scanId: string): Promise<void> {
  const db = await getDb();
  await db.delete(trendScans).where(eq(trendScans.id, scanId));
  revalidatePath("/trends");
}

/* ── Pinned keywords: auto-rescanned daily by the scheduler ────────────── */

const keywordsKey = (brandId: string) => `trends.keywords.${brandId}`;
/** refId for the daily job carrying brand + keyword. */
const jobRef = (brandId: string, keyword: string) => `${brandId}:${keyword}`;

export async function listPinnedKeywords(): Promise<string[]> {
  const brandId = await getActiveBrandId();
  const raw = await getSetting(keywordsKey(brandId));
  try {
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function nextDailyRun(): Date {
  // 09:00 UTC tomorrow — one scan per pinned keyword per day.
  const d = new Date();
  d.setUTCHours(9, 0, 0, 0);
  if (d <= new Date()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export async function pinKeywordAction(
  keyword: string,
): Promise<{ ok: boolean; message?: string }> {
  const kw = keyword.trim().toLowerCase();
  if (kw.length < 2 || kw.length > 80) {
    return { ok: false, message: "Keyword must be 2–80 characters." };
  }
  const db = await getDb();
  const brandId = await getActiveBrandId();
  const current = await listPinnedKeywords();
  if (current.includes(kw)) return { ok: true };
  if (current.length >= 8) {
    return { ok: false, message: "8 pinned keywords max — unpin one first." };
  }
  await setSetting(keywordsKey(brandId), JSON.stringify([...current, kw]));
  await db.insert(scheduleJobs).values({
    id: uuid(),
    kind: "trend_scan",
    refId: jobRef(brandId, kw),
    runAt: nextDailyRun(),
  });
  revalidatePath("/trends");
  return { ok: true };
}

export async function unpinKeywordAction(keyword: string): Promise<void> {
  const kw = keyword.trim().toLowerCase();
  const db = await getDb();
  const brandId = await getActiveBrandId();
  const current = await listPinnedKeywords();
  await setSetting(
    keywordsKey(brandId),
    JSON.stringify(current.filter((k) => k !== kw)),
  );
  await db
    .update(scheduleJobs)
    .set({ status: "canceled" })
    .where(
      and(
        eq(scheduleJobs.kind, "trend_scan"),
        eq(scheduleJobs.refId, jobRef(brandId, kw)),
        inArray(scheduleJobs.status, ["pending"]),
      ),
    );
  revalidatePath("/trends");
}
