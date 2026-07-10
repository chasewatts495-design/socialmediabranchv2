"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/settings";

export async function markNotificationsReadAction(): Promise<void> {
  await setSetting("notifications.readAt", new Date().toISOString());
  revalidatePath("/", "layout");
}
