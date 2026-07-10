import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const id = (name = "id") => text(name);
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ── Platforms ─────────────────────────────────────────────────────────── */

export const platforms = pgTable("platforms", {
  id: id().primaryKey(), // slug: instagram | facebook | tiktok | x | ...
  displayName: text("display_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ── Brands ────────────────────────────────────────────────────────────── */

export const brands = pgTable("brands", {
  id: id().primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#b08a2e"),
  isDemo: boolean("is_demo").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/* ── Accounts & credentials ────────────────────────────────────────────── */

export const accounts = pgTable(
  "accounts",
  {
    id: id().primaryKey(),
    platformId: text("platform_id")
      .notNull()
      .references(() => platforms.id),
    brandId: text("brand_id").references(() => brands.id, {
      onDelete: "set null",
    }),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    avatarColor: text("avatar_color").notNull().default("#b08a2e"),
    mode: text("mode").notNull().default("demo"), // demo | live | manual
    status: text("status").notNull().default("connected"), // connected | error | disconnected
    timezone: text("timezone").notNull().default("UTC"),
    postingEnabled: boolean("posting_enabled").notNull().default(true),
    syncEnabled: boolean("sync_enabled").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncError: text("sync_error"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("accounts_platform_idx").on(t.platformId),
    index("accounts_brand_idx").on(t.brandId),
  ],
);

export const credentials = pgTable("credentials", {
  id: id().primaryKey(),
  accountId: text("account_id")
    .notNull()
    .unique()
    .references(() => accounts.id, { onDelete: "cascade" }),
  authKind: text("auth_kind").notNull(), // oauth2 | api_key | manual
  encryptedPayload: text("encrypted_payload").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ── Analytics ─────────────────────────────────────────────────────────── */

export const metricSnapshots = pgTable(
  "metric_snapshots",
  {
    id: id().primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // YYYY-MM-DD (account-local day)
    followers: integer("followers"),
    following: integer("following"),
    postCount: integer("post_count"),
    impressions: integer("impressions"),
    reach: integer("reach"),
    profileViews: integer("profile_views"),
    engagements: integer("engagements"),
    likes: integer("likes"),
    comments: integer("comments"),
    shares: integer("shares"),
    saves: integer("saves"),
    videoViews: integer("video_views"),
    watchTimeSec: integer("watch_time_sec"),
    source: text("source").notNull().default("demo"), // demo | api | manual | csv
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("metric_snapshots_account_date_uq").on(t.accountId, t.date),
    index("metric_snapshots_account_date_idx").on(t.accountId, t.date),
  ],
);

/* ── Media ─────────────────────────────────────────────────────────────── */

export const mediaAssets = pgTable("media_assets", {
  id: id().primaryKey(),
  filename: text("filename").notNull(),
  storageKey: text("storage_key"), // null for demo data-URI assets
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  width: integer("width"),
  height: integer("height"),
  durationSec: integer("duration_sec"),
  thumbnailUrl: text("thumbnail_url"),
  altText: text("alt_text"),
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  source: text("source").notNull().default("upload"), // upload | demo
  createdAt: createdAt(),
});

/* ── Posts ─────────────────────────────────────────────────────────────── */

export const posts = pgTable("posts", {
  id: id().primaryKey(),
  caption: text("caption").notNull().default(""),
  // draft | scheduled | publishing | published | partially_failed | failed
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  sourceReportId: text("source_report_id"),
  recycledFromPostId: text("recycled_from_post_id"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const postMedia = pgTable(
  "post_media",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    mediaAssetId: text("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.mediaAssetId] })],
);

export type PostTargetMetrics = {
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  videoViews?: number;
  engagementRate?: number;
};

export const postTargets = pgTable(
  "post_targets",
  {
    id: id().primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    variantCaption: text("variant_caption").notNull().default(""),
    variantMeta: jsonb("variant_meta")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Per-platform schedule override; null → use the post's scheduledAt. */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    // pending | queued | publishing | published | failed | skipped | manual_required
    status: text("status").notNull().default("pending"),
    externalPostId: text("external_post_id"),
    externalUrl: text("external_url"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    metrics: jsonb("metrics").$type<PostTargetMetrics>(),
    metricsSyncedAt: timestamp("metrics_synced_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("post_targets_post_account_uq").on(t.postId, t.accountId),
    index("post_targets_account_published_idx").on(t.accountId, t.publishedAt),
    index("post_targets_status_idx").on(t.status),
  ],
);

/* ── Content recycling ─────────────────────────────────────────────────── */

export const recycleRules = pgTable(
  "recycle_rules",
  {
    id: id().primaryKey(),
    accountId: text("account_id")
      .notNull()
      .unique()
      .references(() => accounts.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    everyHours: integer("every_hours").notNull().default(72),
    noRepeatDays: integer("no_repeat_days").notNull().default(30),
    windowStartHour: integer("window_start_hour").notNull().default(9),
    windowEndHour: integer("window_end_hour").notNull().default(21),
    freshenCaption: boolean("freshen_caption").notNull().default(false),
    lastPickedAt: timestamp("last_picked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("recycle_rules_account_idx").on(t.accountId)],
);

/* ── Background jobs ───────────────────────────────────────────────────── */

export const scheduleJobs = pgTable(
  "schedule_jobs",
  {
    id: id().primaryKey(),
    kind: text("kind").notNull(), // publish_post | sync_stats | ai_report | recycle_pick
    refId: text("ref_id").notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"), // pending | running | done | failed | canceled
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("schedule_jobs_status_runat_idx").on(t.status, t.runAt)],
);

/* ── AI ────────────────────────────────────────────────────────────────── */

export const aiConversations = pgTable("ai_conversations", {
  id: id().primaryKey(),
  title: text("title").notNull().default("New conversation"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id().primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    contextMeta: jsonb("context_meta").$type<Record<string, unknown>>(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId)],
);

export const aiReports = pgTable("ai_reports", {
  id: id().primaryKey(),
  // account_audit | content_plan | post_ideas | weekly_review | ad_brief
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"), // pending | running | complete | failed
  params: jsonb("params").$type<Record<string, unknown>>().notNull()
    .default(sql`'{}'::jsonb`),
  inputSummary: jsonb("input_summary").$type<Record<string, unknown>>(),
  result: jsonb("result").$type<Record<string, unknown>>(),
  resultMarkdown: text("result_markdown"),
  model: text("model"),
  generatedBy: text("generated_by"), // claude | demo
  error: text("error"),
  createdAt: createdAt(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/* ── Operations ────────────────────────────────────────────────────────── */

export const activityLog = pgTable(
  "activity_log",
  {
    id: id().primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    level: text("level").notNull().default("info"), // info | warn | error
    event: text("event").notNull(), // e.g. post.published, sync.completed
    accountId: text("account_id"),
    postId: text("post_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
  },
  (t) => [index("activity_log_ts_idx").on(t.ts)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ── Relations (for the drizzle relational query API) ──────────────────── */

export const platformsRelations = relations(platforms, ({ many }) => ({
  accounts: many(accounts),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  accounts: many(accounts),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  platform: one(platforms, {
    fields: [accounts.platformId],
    references: [platforms.id],
  }),
  brand: one(brands, {
    fields: [accounts.brandId],
    references: [brands.id],
  }),
  credential: one(credentials, {
    fields: [accounts.id],
    references: [credentials.accountId],
  }),
  recycleRule: one(recycleRules, {
    fields: [accounts.id],
    references: [recycleRules.accountId],
  }),
  snapshots: many(metricSnapshots),
  targets: many(postTargets),
}));

export const recycleRulesRelations = relations(recycleRules, ({ one }) => ({
  account: one(accounts, {
    fields: [recycleRules.accountId],
    references: [accounts.id],
  }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  account: one(accounts, {
    fields: [credentials.accountId],
    references: [accounts.id],
  }),
}));

export const metricSnapshotsRelations = relations(
  metricSnapshots,
  ({ one }) => ({
    account: one(accounts, {
      fields: [metricSnapshots.accountId],
      references: [accounts.id],
    }),
  }),
);

export const postsRelations = relations(posts, ({ many }) => ({
  targets: many(postTargets),
  media: many(postMedia),
}));

export const postMediaRelations = relations(postMedia, ({ one }) => ({
  post: one(posts, { fields: [postMedia.postId], references: [posts.id] }),
  asset: one(mediaAssets, {
    fields: [postMedia.mediaAssetId],
    references: [mediaAssets.id],
  }),
}));

export const mediaAssetsRelations = relations(mediaAssets, ({ many }) => ({
  postMedia: many(postMedia),
}));

export const postTargetsRelations = relations(postTargets, ({ one }) => ({
  post: one(posts, { fields: [postTargets.postId], references: [posts.id] }),
  account: one(accounts, {
    fields: [postTargets.accountId],
    references: [accounts.id],
  }),
}));

export const aiConversationsRelations = relations(
  aiConversations,
  ({ many }) => ({ messages: many(aiMessages) }),
);

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));
