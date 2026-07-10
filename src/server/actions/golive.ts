"use server";

import { revalidatePath } from "next/cache";
import { setSetting } from "@/lib/settings";

export async function dismissGoLiveAction(): Promise<void> {
  await setSetting("golive.dismissed", "true");
  revalidatePath("/");
}
