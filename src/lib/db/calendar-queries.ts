import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import { getDb } from "./client";
import { accounts, posts, postTargets } from "./schema";
import type { PlatformId } from "@/lib/connectors/types";

export interface CalendarPost {
  id: string;
  caption: string;
  status: string;
  at: string; // ISO — scheduledAt or publishedAt
  platforms: PlatformId[];
  targetCount: number;
}

export interface QueueRow {
  targetId: string;
  postId: string;
  caption: string;
  postStatus: string;
  scheduledAt: string | null;
  status: string;
  errorMessage: string | null;
  externalUrl: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  accountHandle: string;
  accountColor: string;
  platformId: PlatformId;
  mode: string;
}

export async function getCalendarPosts(
  monthStart: Date,
  monthEnd: Date,
): Promise<CalendarPost[]> {
  const db = await getDb();
  const rows = await db.query.posts.findMany({
    where: (p) =>
      or(
        and(gte(p.scheduledAt, monthStart), lte(p.scheduledAt, monthEnd)),
        and(gte(p.publishedAt, monthStart), lte(p.publishedAt, monthEnd)),
      ),
    with: { targets: { with: { account: true } } },
  });
  return rows
    .map((p) => {
      const at = (p.status === "scheduled" ? p.scheduledAt : p.publishedAt) ??
        p.scheduledAt ??
        p.publishedAt;
      if (!at) return null;
      return {
        id: p.id,
        caption: p.caption,
        status: p.status,
        at: at.toISOString(),
        platforms: [
          ...new Set(p.targets.map((t) => t.account.platformId as PlatformId)),
        ],
        targetCount: p.targets.length,
      };
    })
    .filter((p): p is CalendarPost => Boolean(p))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export async function getQueueRows(): Promise<QueueRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ target: postTargets, post: posts, account: accounts })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .innerJoin(accounts, eq(postTargets.accountId, accounts.id))
    .where(
      or(
        eq(postTargets.status, "queued"),
        eq(postTargets.status, "publishing"),
        eq(postTargets.status, "failed"),
        eq(postTargets.status, "manual_required"),
        eq(postTargets.status, "skipped"),
      ),
    )
    .orderBy(desc(posts.updatedAt))
    .limit(200);

  return rows.map(({ target, post, account }) => ({
    targetId: target.id,
    postId: target.postId,
    caption: post.caption,
    postStatus: post.status,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    status: target.status,
    errorMessage: target.errorMessage,
    externalUrl: target.externalUrl,
    attemptCount: target.attemptCount,
    lastAttemptAt: target.lastAttemptAt?.toISOString() ?? null,
    accountHandle: account.handle,
    accountColor: account.avatarColor,
    platformId: account.platformId as PlatformId,
    mode: account.mode,
  }));
}
