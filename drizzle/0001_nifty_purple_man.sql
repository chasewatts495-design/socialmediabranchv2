CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#b08a2e' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recycle_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"every_hours" integer DEFAULT 72 NOT NULL,
	"no_repeat_days" integer DEFAULT 30 NOT NULL,
	"window_start_hour" integer DEFAULT 9 NOT NULL,
	"window_end_hour" integer DEFAULT 21 NOT NULL,
	"freshen_caption" boolean DEFAULT false NOT NULL,
	"last_picked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recycle_rules_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "brand_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "posting_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "sync_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "post_targets" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "recycled_from_post_id" text;--> statement-breakpoint
ALTER TABLE "recycle_rules" ADD CONSTRAINT "recycle_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recycle_rules_account_idx" ON "recycle_rules" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_brand_idx" ON "accounts" USING btree ("brand_id");--> statement-breakpoint
INSERT INTO "brands" ("id", "name", "color", "is_demo", "sort_order")
VALUES ('brand-demo', 'Demo Brand', '#b08a2e', true, 0)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
UPDATE "accounts" SET "brand_id" = 'brand-demo' WHERE "brand_id" IS NULL;
