import { getDb } from "./client";
import type {
  ComposerAccount,
  ComposerInitial,
} from "@/components/composer/ComposerClient";
import type { PlatformId } from "@/lib/connectors/types";

export async function getComposerAccounts(): Promise<ComposerAccount[]> {
  const db = await getDb();
  const rows = await db.query.accounts.findMany({
    orderBy: (a, { asc }) => asc(a.sortOrder),
  });
  return rows.map((a) => ({
    id: a.id,
    platformId: a.platformId as PlatformId,
    handle: a.handle,
    displayName: a.displayName,
    avatarColor: a.avatarColor,
    mode: a.mode,
  }));
}

export async function getDraftInitial(
  postId: string,
): Promise<ComposerInitial | null> {
  const db = await getDb();
  const post = await db.query.posts.findFirst({
    where: (p, { eq }) => eq(p.id, postId),
    with: {
      media: { with: { asset: true } },
      targets: true,
    },
  });
  if (!post) return null;
  // Only drafts and scheduled posts are editable in the composer.
  if (!["draft", "scheduled"].includes(post.status)) return null;
  return {
    postId: post.id,
    caption: post.caption,
    mediaIds: [...post.media]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => m.mediaAssetId),
    targets: post.targets.map((t) => ({
      accountId: t.accountId,
      caption: t.variantCaption,
      meta: t.variantMeta,
    })),
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
  };
}
