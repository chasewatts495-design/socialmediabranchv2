import { eq, inArray } from "drizzle-orm";
import type { Db } from "./client";
import {
  accounts,
  activityLog,
  mediaAssets,
  metricSnapshots,
  platforms,
  postMedia,
  posts,
  postTargets,
  scheduleJobs,
  settings,
} from "./schema";
import type { PlatformId } from "@/lib/connectors/types";
import {
  daysAgo,
  postMetricsFor,
  stableRand,
  statsRange,
} from "@/lib/connectors/demo/generators";
import {
  DEMO_EXTERNAL_URL,
  demoKey,
  profileFor,
} from "@/lib/connectors/demo/profiles";

export const SEED_VERSION = "1";
const HISTORY_DAYS = 90;

const uuid = () => crypto.randomUUID();

/* ── Platform registry rows ────────────────────────────────────────────── */

const PLATFORM_ROWS: {
  id: PlatformId;
  displayName: string;
  sortOrder: number;
}[] = [
  { id: "instagram", displayName: "Instagram", sortOrder: 0 },
  { id: "facebook", displayName: "Facebook", sortOrder: 1 },
  { id: "tiktok", displayName: "TikTok", sortOrder: 2 },
  { id: "x", displayName: "X (Twitter)", sortOrder: 3 },
  { id: "youtube", displayName: "YouTube", sortOrder: 4 },
  { id: "reddit", displayName: "Reddit", sortOrder: 5 },
  { id: "pinterest", displayName: "Pinterest", sortOrder: 6 },
  { id: "snapchat", displayName: "Snapchat", sortOrder: 7 },
];

/* ── Demo brand accounts ───────────────────────────────────────────────── */

export interface DemoAccountDef {
  key: string; // stable PRNG key
  platformId: PlatformId;
  handle: string;
  displayName: string;
  avatarColor: string;
  mode: "demo" | "manual";
}

export const DEMO_ACCOUNTS: DemoAccountDef[] = [
  {
    key: "aurora-ig",
    platformId: "instagram",
    handle: "@aurora.collective",
    displayName: "Aurora Collective",
    avatarColor: "#e4405f",
    mode: "demo",
  },
  {
    key: "aurora-fb",
    platformId: "facebook",
    handle: "Aurora Collective",
    displayName: "Aurora Collective",
    avatarColor: "#1877f2",
    mode: "demo",
  },
  {
    key: "aurora-tt",
    platformId: "tiktok",
    handle: "@auroracollective",
    displayName: "Aurora Collective",
    avatarColor: "#22d3ee",
    mode: "demo",
  },
  {
    key: "aurora-x",
    platformId: "x",
    handle: "@auroracollective",
    displayName: "Aurora Collective",
    avatarColor: "#cbd5e1",
    mode: "demo",
  },
  {
    key: "aurora-yt",
    platformId: "youtube",
    handle: "Aurora Studio",
    displayName: "Aurora Studio",
    avatarColor: "#ff4d4d",
    mode: "demo",
  },
  {
    key: "aurora-rd",
    platformId: "reddit",
    handle: "u/auroracollective",
    displayName: "Aurora on Reddit",
    avatarColor: "#ff4500",
    mode: "demo",
  },
  {
    key: "aurora-pin",
    platformId: "pinterest",
    handle: "@auroracollective",
    displayName: "Aurora Collective",
    avatarColor: "#e60023",
    mode: "demo",
  },
  {
    key: "aurora-sc",
    platformId: "snapchat",
    handle: "@auroracollective",
    displayName: "Aurora Collective",
    avatarColor: "#fffc00",
    mode: "manual",
  },
  {
    key: "outlet-ig",
    platformId: "instagram",
    handle: "@aurora.outlet",
    displayName: "Aurora Outlet",
    avatarColor: "#f472b6",
    mode: "demo",
  },
  {
    key: "bts-tt",
    platformId: "tiktok",
    handle: "@aurora.bts",
    displayName: "Aurora Behind the Scenes",
    avatarColor: "#a78bfa",
    mode: "demo",
  },
];

/* ── Demo media (inline SVG gradients — no storage required) ───────────── */

const GRADIENTS: [string, string, string][] = [
  ["Sunrise Drop", "#f97316", "#db2777"],
  ["Studio Light", "#8b5cf6", "#3b82f6"],
  ["Forest Run", "#059669", "#84cc16"],
  ["Night Set", "#1e293b", "#7c5cff"],
  ["Coral Wave", "#fb7185", "#f59e0b"],
  ["Deep Water", "#0ea5e9", "#1d4ed8"],
  ["Golden Hour", "#f59e0b", "#ef4444"],
  ["Mint Fresh", "#2dd4bf", "#22c55e"],
  ["Berry Mix", "#c026d3", "#7c3aed"],
  ["Slate Calm", "#475569", "#94a3b8"],
  ["Neon Run", "#22d3ee", "#a3e635"],
  ["Dusty Rose", "#f472b6", "#c084fc"],
  ["Ember", "#ef4444", "#78350f"],
  ["Ocean Air", "#38bdf8", "#34d399"],
  ["Lilac Sky", "#a78bfa", "#f0abfc"],
  ["Charcoal", "#111827", "#4b5563"],
];

function svgDataUri(label: string, from: string, to: string, w = 1080, h = 1080) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/><text x='50%' y='52%' font-family='sans-serif' font-size='${Math.round(w / 16)}' font-weight='bold' fill='rgba(255,255,255,0.92)' text-anchor='middle'>${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ── Demo captions ─────────────────────────────────────────────────────── */

const CAPTIONS = [
  "New drop just landed. Which colorway are you taking? 👀 #newdrop #auroracollective",
  "Behind the scenes of our spring shoot — the sunrise did all the work. ☀️",
  "POV: your morning routine finally feels like yours. #morningroutine",
  "We asked, you voted. The community pick is back in stock!",
  "3 ways to style the Aurora hoodie — save this for later. 🔖",
  "The detail everyone keeps asking about ➡️ hand-stitched, every single one.",
  "From sketch to shelf in 90 days. Here's how it happens.",
  "Weekend reset. What's on your list?",
  "Our founder answers your top 5 questions — part 2 tomorrow.",
  "Small team, big week. Thank you for 10k! 💜",
  "Restock alert: the sold-out set returns Friday at 10am.",
  "How we cut waste 40% this quarter — full breakdown on the blog.",
  "This took 47 takes. Worth it. 😂",
  "Customer spotlight: @jamie.runs took Aurora up a mountain.",
  "Drop a 🔥 if you want this in navy.",
  "The unboxing experience, reimagined. Notice anything different?",
  "Rainy day fits. Umbrella optional.",
  "Meet the maker: 20 years of pattern cutting in 60 seconds.",
  "Your reviews, our roadmap. Keep them coming.",
  "Last call — the summer capsule retires Sunday at midnight.",
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

async function chunkedInsert<T>(
  insertFn: (rows: T[]) => Promise<unknown>,
  rows: T[],
  size = 100,
) {
  for (let i = 0; i < rows.length; i += size) {
    await insertFn(rows.slice(i, i + size));
  }
}

/* ── The seed ──────────────────────────────────────────────────────────── */

export async function runSeed(db: Db): Promise<void> {
  // Platforms (idempotent).
  await db.insert(platforms).values(PLATFORM_ROWS).onConflictDoNothing();

  // Demo media assets.
  const assetIds: string[] = [];
  const assetRows = GRADIENTS.map(([label, from, to], i) => {
    const aid = uuid();
    assetIds.push(aid);
    return {
      id: aid,
      filename: `${label.toLowerCase().replace(/\s+/g, "-")}.svg`,
      url: svgDataUri(label, from, to),
      mimeType: "image/svg+xml",
      sizeBytes: 2048,
      width: 1080,
      height: 1080,
      altText: `${label} demo graphic`,
      tags: ["demo", i % 2 === 0 ? "product" : "lifestyle"],
      source: "demo",
    };
  });
  await chunkedInsert((rows) => db.insert(mediaAssets).values(rows), assetRows);

  // Accounts, snapshots, historical posts.
  const accountIdByKey = new Map<string, string>();
  const snapshotRows: (typeof metricSnapshots.$inferInsert)[] = [];
  const postRows: (typeof posts.$inferInsert)[] = [];
  const targetRows: (typeof postTargets.$inferInsert)[] = [];
  const postMediaRows: (typeof postMedia.$inferInsert)[] = [];

  for (const [idx, def] of DEMO_ACCOUNTS.entries()) {
    const accountId = uuid();
    accountIdByKey.set(def.key, accountId);
    await db.insert(accounts).values({
      id: accountId,
      platformId: def.platformId,
      handle: def.handle,
      displayName: def.displayName,
      avatarColor: def.avatarColor,
      mode: def.mode,
      sortOrder: idx,
      lastSyncAt: new Date(),
    });

    const profile = profileFor(def.platformId, def.handle);
    const prngKey = demoKey(def.platformId, def.handle);
    for (const s of statsRange(prngKey, profile, daysAgo(HISTORY_DAYS))) {
      snapshotRows.push({
        id: uuid(),
        accountId,
        date: s.date,
        followers: s.followers,
        following: s.following,
        postCount: s.postCount,
        impressions: s.impressions,
        reach: s.reach,
        profileViews: s.profileViews,
        engagements: s.engagements,
        likes: s.likes,
        comments: s.comments,
        shares: s.shares,
        saves: s.saves,
        videoViews: s.videoViews,
        watchTimeSec: s.watchTimeSec,
        source: "demo",
      });
    }

    // Historical published posts (each historic post targets one account).
    const rand = stableRand(`${def.key}|posts`);
    const postCount = 14 + Math.floor(rand() * 8);
    for (let p = 0; p < postCount; p++) {
      const dayOffset = 1 + Math.floor(rand() * (HISTORY_DAYS - 2));
      const isoDate = daysAgo(dayOffset);
      const publishedAt = new Date(`${isoDate}T${10 + Math.floor(rand() * 10)}:15:00Z`);
      const caption = CAPTIONS[Math.floor(rand() * CAPTIONS.length)];
      const metrics = postMetricsFor(prngKey, profile, isoDate, p);
      const postId = uuid();
      const externalId = `${def.key}-${p}`;

      postRows.push({
        id: postId,
        caption,
        status: "published",
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      });
      targetRows.push({
        id: uuid(),
        postId,
        accountId,
        variantCaption: caption,
        status: "published",
        externalPostId: externalId,
        externalUrl: DEMO_EXTERNAL_URL[def.platformId](externalId),
        attemptCount: 1,
        lastAttemptAt: publishedAt,
        publishedAt,
        metrics,
        metricsSyncedAt: new Date(),
      });
      if (def.platformId !== "x" && def.platformId !== "reddit") {
        postMediaRows.push({
          postId,
          mediaAssetId: assetIds[Math.floor(rand() * assetIds.length)],
          sortOrder: 0,
        });
      }
    }
  }

  await chunkedInsert(
    (rows) => db.insert(metricSnapshots).values(rows),
    snapshotRows,
  );
  await chunkedInsert((rows) => db.insert(posts).values(rows), postRows);
  await chunkedInsert((rows) => db.insert(postTargets).values(rows), targetRows);
  await chunkedInsert((rows) => db.insert(postMedia).values(rows), postMediaRows);

  // One multi-account scheduled post (tomorrow 15:00 UTC) + one draft.
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(15, 0, 0, 0);

  const scheduledPostId = uuid();
  await db.insert(posts).values({
    id: scheduledPostId,
    caption:
      "Sneak peek: the autumn capsule arrives next week. First look for followers only. 🍂",
    status: "scheduled",
    scheduledAt: tomorrow,
  });
  const scheduledTargets = ["aurora-ig", "aurora-tt", "aurora-fb"]
    .map((k) => accountIdByKey.get(k))
    .filter((v): v is string => Boolean(v));
  for (const accountId of scheduledTargets) {
    await db.insert(postTargets).values({
      id: uuid(),
      postId: scheduledPostId,
      accountId,
      variantCaption:
        "Sneak peek: the autumn capsule arrives next week. First look for followers only. 🍂",
      status: "queued",
    });
  }
  await db.insert(postMedia).values({
    postId: scheduledPostId,
    mediaAssetId: assetIds[3],
    sortOrder: 0,
  });
  await db.insert(scheduleJobs).values({
    id: uuid(),
    kind: "publish_post",
    refId: scheduledPostId,
    runAt: tomorrow,
  });

  await db.insert(posts).values({
    id: uuid(),
    caption: "Draft: giveaway announcement — finalize prize list before posting.",
    status: "draft",
  });

  // Daily stats sync for every account at 06:00 UTC tomorrow.
  const nextSync = new Date();
  nextSync.setUTCDate(nextSync.getUTCDate() + 1);
  nextSync.setUTCHours(6, 0, 0, 0);
  for (const accountId of accountIdByKey.values()) {
    await db.insert(scheduleJobs).values({
      id: uuid(),
      kind: "sync_stats",
      refId: accountId,
      runAt: nextSync,
    });
  }

  // A little activity so the dashboard strip isn't empty.
  const igId = accountIdByKey.get("aurora-ig");
  await db.insert(activityLog).values([
    {
      id: uuid(),
      event: "seed.completed",
      level: "info",
      detail: { accounts: DEMO_ACCOUNTS.length, days: HISTORY_DAYS },
    },
    {
      id: uuid(),
      event: "sync.completed",
      level: "info",
      accountId: igId,
      detail: { source: "demo" },
    },
  ]);

  // Defaults.
  await db
    .insert(settings)
    .values([
      { key: "seed.version", value: SEED_VERSION },
      { key: "ai.model", value: "claude-sonnet-5" },
      { key: "demo.simulateFailures", value: "false" },
      { key: "app.timezone", value: "UTC" },
    ])
    .onConflictDoNothing();
}

/** Deletes demo-sourced rows so the seed can run again. */
export async function clearDemoData(db: Db): Promise<void> {
  const demoAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.mode, ["demo", "manual"]));
  const ids = demoAccounts.map((a) => a.id);
  if (ids.length) {
    const targets = await db
      .select({ postId: postTargets.postId })
      .from(postTargets)
      .where(inArray(postTargets.accountId, ids));
    const postIds = [...new Set(targets.map((t) => t.postId))];
    if (postIds.length) {
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    await db.delete(accounts).where(inArray(accounts.id, ids));
  }
  await db.delete(mediaAssets).where(eq(mediaAssets.source, "demo"));
  await db.delete(scheduleJobs).where(eq(scheduleJobs.status, "pending"));
  await db.delete(settings).where(eq(settings.key, "seed.version"));
}
