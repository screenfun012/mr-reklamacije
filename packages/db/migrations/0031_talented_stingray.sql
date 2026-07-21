ALTER TABLE "domace_claims" ADD COLUMN "findings" jsonb;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD COLUMN "findings" jsonb;--> statement-breakpoint
-- Backfill: an existing single-field note becomes one finding (type left blank).
-- Non-destructive — internal_notes is kept; the app just stops using it.
UPDATE "emotive_claims" SET "findings" = jsonb_build_array(jsonb_build_object('text', "internal_notes", 'type', '')) WHERE "internal_notes" IS NOT NULL AND btrim("internal_notes") <> '';--> statement-breakpoint
UPDATE "domace_claims" SET "findings" = jsonb_build_array(jsonb_build_object('text', "internal_notes", 'type', '')) WHERE "internal_notes" IS NOT NULL AND btrim("internal_notes") <> '';