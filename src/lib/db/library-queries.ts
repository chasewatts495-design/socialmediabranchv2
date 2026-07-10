import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { mediaAssets, postMedia, posts, postTargets } from "./schema";
import type { LibraryAsset } from "@/components/library/AssetGrid";

export async function getLibraryAssets(): Promise<LibraryAsset[]> {
  const db = await getDb();
  const rows = await db
    .select({
      asset: mediaAssets,
      usedBy: sql<number>`count(${postMedia.postId})::int`,
    })
    .from(mediaAssets)
    .leftJoin(postMedia, eq(postMedia.mediaAssetId, mediaAssets.id))
    .groupBy(mediaAssets.id)
    .orderBy(desc(mediaAssets.createdAt));

  return rows.map(({ asset, usedBy }) => ({
    id: asset.id,
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    durationSec: asset.durationSec,
    altText: asset.altText,
    tags: asset.tags,
    source: asset.source,
    usedBy,
    createdAt: asset.createdAt.toISOString(),
  }));
}

export interface DraftRow {
  id: string;
  caption: string;
  updatedAt: string;
  targetCount: number;
  thumbnailUrl: string | null;
}

export async function getDrafts(): Promise<DraftRow[]> {
  const db = await getDb();
  const draftPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "draft"))
    .orderBy(desc(posts.updatedAt))
    .limit(20);
  if (draftPosts.length === 0) return [];

  const ids = draftPosts.map((p) => p.id);
  const targets = await db
    .select({ postId: postTargets.postId })
    .from(postTargets)
    .where(sql`${postTargets.postId} in ${ids}`);
  const media = await db.query.postMedia.findMany({
    where: (pm, { inArray }) => inArray(pm.postId, ids),
    with: { asset: true },
    orderBy: (pm, { asc }) => asc(pm.sortOrder),
  });
  const thumbByPost = new Map<string, string>();
  for (const m of media) {
    if (!thumbByPost.has(m.postId)) {
      thumbByPost.set(m.postId, m.asset.thumbnailUrl ?? m.asset.url);
    }
  }
  const targetCount = new Map<string, number>();
  for (const t of targets) {
    targetCount.set(t.postId, (targetCount.get(t.postId) ?? 0) + 1);
  }

  return draftPosts.map((p) => ({
    id: p.id,
    caption: p.caption || "(no caption yet)",
    updatedAt: p.updatedAt.toISOString(),
    targetCount: targetCount.get(p.id) ?? 0,
    thumbnailUrl: thumbByPost.get(p.id) ?? null,
  }));
}
