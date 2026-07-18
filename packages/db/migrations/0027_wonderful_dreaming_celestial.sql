ALTER TABLE "emotive_claims" ADD COLUMN "client_visible_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
UPDATE "emotive_claims" SET "published_at" = "created_at" WHERE "published_at" IS NULL;