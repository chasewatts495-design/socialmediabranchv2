import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  activityLog,
  postMedia,
  posts,
  postTargets,
  recycleRules,
  scheduleJobs,
} from "@/lib/db/schema";
import {
  getAnthropicClient,
  getAiModel,
  recordAiUsage,
} from "@/lib/ai/client";

const uuid = () => crypto.randomUUID();

/** Light template variations for demo-mode caption freshening. */
const FRESHEN_PREFIXES = [
  "ICYMI: ",
  "Still one of our favorites — ",
  "Back by popular demand: ",
  "Worth a second look: ",
  "In case you missed it: ",
];

async function freshenCaption(caption: string): Promise<string> {
  if (!caption.trim()) return caption;
  const client = await getAnthropicClient();
  if (client) {
    try {
      const model = await getAiModel();
      const response = await client.messages.create({
        model,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content:
              "Rewrite this social media caption so it feels fresh for a repost. Keep the same message, tone, emoji style, and any hashtags. Reply with ONLY the rewritten caption.\n\n" +
              caption,
          },
        ],
      });
      await recordAiUsage(
        response.usage.input_tokens,
        response.usage.output_tokens,
      );
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      if (text) return text;
    } catch {
      // fall through to the template variation
    }
  }
  const prefix =
    FRESHEN_PREFIXES[Math.floor(Math.random() * FRESHEN_PREFIXES.length)];
  return prefix + caption;
}

/**
 * Random future publish time: somewhere in the next cadence window,
 * at least 30 minutes out, nudged inside the rule's posting hours (UTC).
 */
function pickPublishTime(rule: {
  everyHours: number;
  windowStartHour: number;
  windowEndHour: number;
}): Date {
  const minMs = 30 * 60_000;
  const spanMs = Math.max(rule.everyHours, 1) * 3_600_000;
  const t = new Date(Date.now() + minMs + Math.random() * spanMs);

  const start = Math.min(rule.windowStartHour, 23);
  const end = Math.max(rule.windowEndHour, start + 1);
  const hour = t.getUTCHours();
  if (hour < start || hour >= end) {
    if (hour >= end) t.setUTCDate(t.getUTCDate() + 1);
    const randomHour = start + Math.floor(Math.random() * (end - start));
    t.setUTCHours(randomHour, Math.floor(Math.random() * 60), 0, 0);
  }
  return t;
}

export interface RecycleResult {
  ok: boolean;
  message: string;
  scheduledPostId?: string;
  scheduledFor?: Date;
}

/**
 * The recycle_pick job: choose a random already-published post for this
 * account that hasn't run recently, clone it (media + platform variant),
 * and schedule the clone at a random time inside the posting window.
 */
export async function runRecyclePick(
  db: Db,
  accountId: string,
): Promise<RecycleResult> {
  const rule = await db.query.recycleRules.findFirst({
    where: (r, { eq: e }) => e(r.accountId, accountId),
  });
  if (!rule || !rule.enabled) {
    return { ok: true, message: "Recycling is off for this account." };
  }
  const account = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
  });
  if (!account) return { ok: false, message: "Account not found." };
  if (!account.postingEnabled) {
    return {
      ok: true,
      message: "Posting is off for this account — nothing recycled.",
    };
  }

  // Everything this account has published, newest first.
  const published = await db
    .select({ target: postTargets, post: posts })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(
      and(
        eq(postTargets.accountId, accountId),
        eq(postTargets.status, "published"),
      ),
    );

  // Roots that already have a clone waiting to publish must not be picked
  // again — otherwise back-to-back picks would double-book the same post.
  const inFlight = await db
    .select({ post: posts })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(
      and(
        eq(postTargets.accountId, accountId),
        inArray(postTargets.status, ["pending", "queued", "publishing"]),
      ),
    );
  const busyRoots = new Set(
    inFlight.map((r) => r.post.recycledFromPostId ?? r.post.id),
  );

  // Group by root post so a recycled copy and its original count as one
  // piece of content, then drop roots that ran within the no-repeat window.
  const cutoff = Date.now() - rule.noRepeatDays * 86_400_000;
  const byRoot = new Map<
    string,
    { latest: (typeof published)[number]; lastPublished: number }
  >();
  for (const row of published) {
    const rootId = row.post.recycledFromPostId ?? row.post.id;
    const ts = row.target.publishedAt?.getTime() ?? 0;
    const existing = byRoot.get(rootId);
    if (!existing) {
      byRoot.set(rootId, { latest: row, lastPublished: ts });
    } else {
      existing.lastPublished = Math.max(existing.lastPublished, ts);
      if (ts > (existing.latest.target.publishedAt?.getTime() ?? 0)) {
        existing.latest = row;
      }
    }
  }
  const eligible = [...byRoot.entries()].filter(
    ([rootId, v]) => v.lastPublished < cutoff && !busyRoots.has(rootId),
  );
  if (eligible.length === 0) {
    return {
      ok: true,
      message: `Nothing eligible yet — every post ran (or is queued) within the last ${rule.noRepeatDays} days.`,
    };
  }

  const [rootId, chosen] =
    eligible[Math.floor(Math.random() * eligible.length)];
  const source = chosen.latest;

  const caption = rule.freshenCaption
    ? await freshenCaption(source.post.caption)
    : source.post.caption;
  const variantCaption = rule.freshenCaption
    ? await freshenCaption(source.target.variantCaption)
    : source.target.variantCaption;
  const runAt = pickPublishTime(rule);

  const newPostId = uuid();
  await db.insert(posts).values({
    id: newPostId,
    caption,
    status: "scheduled",
    scheduledAt: runAt,
    recycledFromPostId: rootId,
  });
  const media = await db
    .select()
    .from(postMedia)
    .where(eq(postMedia.postId, source.post.id));
  if (media.length) {
    await db.insert(postMedia).values(
      media.map((m) => ({
        postId: newPostId,
        mediaAssetId: m.mediaAssetId,
        sortOrder: m.sortOrder,
      })),
    );
  }
  await db.insert(postTargets).values({
    id: uuid(),
    postId: newPostId,
    accountId,
    variantCaption,
    variantMeta: source.target.variantMeta ?? {},
    status: "queued",
  });
  await db.insert(scheduleJobs).values({
    id: uuid(),
    kind: "publish_post",
    refId: newPostId,
    runAt,
  });
  await db
    .update(recycleRules)
    .set({ lastPickedAt: new Date() })
    .where(eq(recycleRules.id, rule.id));
  await db.insert(activityLog).values({
    id: uuid(),
    event: "recycle.scheduled",
    accountId,
    postId: newPostId,
    detail: {
      from: rootId,
      runAt: runAt.toISOString(),
      freshened: rule.freshenCaption,
    },
  });

  return {
    ok: true,
    message: `Recycled a post — scheduled for ${runAt.toISOString()}.`,
    scheduledPostId: newPostId,
    scheduledFor: runAt,
  };
}

/** Preview of what recycling could pick next (for the Recycling tab UI). */
export async function recyclePoolPreview(
  db: Db,
  accountId: string,
  noRepeatDays: number,
): Promise<{ eligibleCount: number; sampleCaptions: string[] }> {
  const published = await db
    .select({ target: postTargets, post: posts })
    .from(postTargets)
    .innerJoin(posts, eq(postTargets.postId, posts.id))
    .where(
      and(
        eq(postTargets.accountId, accountId),
        eq(postTargets.status, "published"),
      ),
    );
  const cutoff = Date.now() - noRepeatDays * 86_400_000;
  const byRoot = new Map<string, { caption: string; lastPublished: number }>();
  for (const row of published) {
    const rootId = row.post.recycledFromPostId ?? row.post.id;
    const ts = row.target.publishedAt?.getTime() ?? 0;
    const existing = byRoot.get(rootId);
    if (!existing) {
      byRoot.set(rootId, { caption: row.post.caption, lastPublished: ts });
    } else {
      existing.lastPublished = Math.max(existing.lastPublished, ts);
    }
  }
  const eligible = [...byRoot.values()].filter(
    (v) => v.lastPublished < cutoff,
  );
  return {
    eligibleCount: eligible.length,
    sampleCaptions: eligible.slice(0, 3).map((v) => v.caption),
  };
}

/** Ensures exactly one pending recycle_pick job exists for the account. */
export async function ensureRecycleJob(
  db: Db,
  accountId: string,
): Promise<void> {
  const pending = await db
    .select({ id: scheduleJobs.id })
    .from(scheduleJobs)
    .where(
      and(
        eq(scheduleJobs.kind, "recycle_pick"),
        eq(scheduleJobs.refId, accountId),
        eq(scheduleJobs.status, "pending"),
      ),
    );
  if (pending.length > 0) return;
  await db.insert(scheduleJobs).values({
    id: uuid(),
    kind: "recycle_pick",
    refId: accountId,
    // First pick runs shortly so the owner sees it work; later picks
    // self-reschedule on the rule's cadence.
    runAt: new Date(Date.now() + 60_000),
  });
}

/** Cancels pending recycle work when a rule is disabled. */
export async function cancelRecycleJobs(
  db: Db,
  accountId: string,
): Promise<void> {
  const pending = await db
    .select({ id: scheduleJobs.id })
    .from(scheduleJobs)
    .where(
      and(
        eq(scheduleJobs.kind, "recycle_pick"),
        eq(scheduleJobs.refId, accountId),
        eq(scheduleJobs.status, "pending"),
      ),
    );
  if (pending.length) {
    await db
      .update(scheduleJobs)
      .set({ status: "canceled" })
      .where(
        inArray(
          scheduleJobs.id,
          pending.map((p) => p.id),
        ),
      );
  }
}
