ALTER TABLE "emotive_claims" ADD COLUMN "outcome_resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "outcome_resolved_at" timestamp with time zone;--> statement-breakpoint
UPDATE "emotive_claims"
SET "outcome_resolved_at" = GREATEST(
  "updated_at",
  (COALESCE("date_of_claim", ("created_at" AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE 'UTC')
)
WHERE "outcome" IN ('accepted', 'rejected')
  AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "domace_claims"
SET "outcome_resolved_at" = GREATEST(
  "updated_at",
  (COALESCE("date_of_claim", ("created_at" AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE 'UTC')
)
WHERE "outcome" IN ('accepted', 'rejected')
  AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_outcome_resolved_at" ON "emotive_claims" USING btree ("outcome_resolved_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_domace_claims_outcome_resolved_at" ON "domace_claims" USING btree ("outcome_resolved_at" DESC);
