"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { getSetting, setSetting } from "@/lib/settings";
import { clearDemoData, runSeed } from "@/lib/db/seed";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function toggleSimulateFailuresAction(): Promise<void> {
  const current = await getSetting("demo.simulateFailures");
  await setSetting("demo.simulateFailures", current === "true" ? "false" : "true");
  revalidatePath("/settings");
}

/**
 * Wipes demo-sourced data (demo/manual accounts, their history, demo media)
 * and re-seeds fresh. Uploaded media and posts on live accounts survive.
 */
export async function reseedDemoDataAction(): Promise<void> {
  const db = await getDb();
  await clearDemoData(db);
  await db.delete(settings).where(eq(settings.key, "seed.lock"));
  await runSeed(db);
  revalidatePath("/", "layout");
}
