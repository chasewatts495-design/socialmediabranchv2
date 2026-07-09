"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { mediaAssets, postMedia } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import type { ActionResult } from "./accounts";

export async function deleteAssetAction(assetId: string): Promise<ActionResult> {
  const db = await getDb();
  const uses = await db
    .select({ postId: postMedia.postId })
    .from(postMedia)
    .where(eq(postMedia.mediaAssetId, assetId))
    .limit(1);
  if (uses.length > 0) {
    return {
      ok: false,
      message: "This asset is used by a post — remove it from the post first.",
    };
  }
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1);
  const asset = rows[0];
  if (!asset) return { ok: false, message: "Asset not found." };

  if (asset.storageKey) {
    try {
      await getStorage().delete(
        asset.url.startsWith("http") ? asset.url : asset.storageKey,
      );
      if (asset.thumbnailUrl) {
        await getStorage().delete(
          asset.thumbnailUrl.startsWith("http")
            ? asset.thumbnailUrl
            : `${asset.id}.thumb.jpg`,
        );
      }
    } catch {
      // best effort — the row is the source of truth
    }
  }
  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
  revalidatePath("/library");
  return { ok: true, message: "Asset deleted." };
}

export async function updateAssetMetaAction(
  assetId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const altText = String(formData.get("altText") ?? "").slice(0, 500);
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
  const db = await getDb();
  await db
    .update(mediaAssets)
    .set({ altText: altText || null, tags })
    .where(eq(mediaAssets.id, assetId));
  revalidatePath("/library");
  return { ok: true, message: "Saved." };
}
