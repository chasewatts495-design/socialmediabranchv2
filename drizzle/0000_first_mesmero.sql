CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_id" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_color" text DEFAULT '#7c5cff' NOT NULL,
	"mode" text DEFAULT 'demo' NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_error" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"event" text NOT NULL,
	"account_id" text,
	"post_id" text,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"context_meta" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_summary" jsonb,
	"result" jsonb,
	"result_markdown" text,
	"model" text,
	"generated_by" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"auth_kind" text NOT NULL,
	"encrypted_payload" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credentials_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"duration_sec" integer,
	"thumbnail_url" text,
	"alt_text" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'upload' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"date" date NOT NULL,
	"followers" integer,
	"following" integer,
	"post_count" integer,
	"impressions" integer,
	"reach" integer,
	"profile_views" integer,
	"engagements" integer,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"saves" integer,
	"video_views" integer,
	"watch_time_sec" integer,
	"source" text DEFAULT 'demo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"post_id" text NOT NULL,
	"media_asset_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "post_media_post_id_media_asset_id_pk" PRIMARY KEY("post_id","media_asset_id")
);
--> statement-breakpoint
CREATE TABLE "post_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"account_id" text NOT NULL,
	"variant_caption" text DEFAULT '' NOT NULL,
	"variant_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"external_post_id" text,
	"external_url" text,
	"error_code" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"metrics" jsonb,
	"metrics_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"source_report_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_platform_idx" ON "accounts" USING btree ("platform_id");--> statement-breakpoint
CREATE INDEX "activity_log_ts_idx" ON "activity_log" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_snapshots_account_date_uq" ON "metric_snapshots" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "metric_snapshots_account_date_idx" ON "metric_snapshots" USING btree ("account_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "post_targets_post_account_uq" ON "post_targets" USING btree ("post_id","account_id");--> statement-breakpoint
CREATE INDEX "post_targets_account_published_idx" ON "post_targets" USING btree ("account_id","published_at");--> statement-breakpoint
CREATE INDEX "post_targets_status_idx" ON "post_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schedule_jobs_status_runat_idx" ON "schedule_jobs" USING btree ("status","run_at");