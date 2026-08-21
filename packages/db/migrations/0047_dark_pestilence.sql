ALTER TABLE "claim_category_fields" DROP CONSTRAINT "claim_category_fields_field_type_check";--> statement-breakpoint
ALTER TABLE "claim_category_fields" ADD COLUMN "is_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "claim_category_fields" ADD CONSTRAINT "claim_category_fields_field_type_check" CHECK ("claim_category_fields"."field_type" IN ('select', 'text'));--> statement-breakpoint
-- Answers move from a flat `{ field: value }` map to one keyed by the category they were
-- entered under, so a claim that changes its kind of work keeps what was typed instead of
-- losing it. Every claim has a category (backfilled in 0045), so nothing is left unattributed.
UPDATE "emotive_claims"
SET "category_field_values" = jsonb_build_object("category_id"::text, "category_field_values")
WHERE "category_field_values" IS NOT NULL AND "category_id" IS NOT NULL;--> statement-breakpoint
UPDATE "domace_claims"
SET "category_field_values" = jsonb_build_object("category_id"::text, "category_field_values")
WHERE "category_field_values" IS NOT NULL AND "category_id" IS NOT NULL;
