CREATE TABLE "trend_scans" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text,
	"keyword" text NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signals" jsonb,
	"analysis" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trend_scans" ADD CONSTRAINT "trend_scans_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trend_scans_created_idx" ON "trend_scans" USING btree ("created_at");