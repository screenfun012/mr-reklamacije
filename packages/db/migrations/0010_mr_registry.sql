-- mr_registry: global MR unique registry across emotive_claims + domace_claims.
-- Rollback (manual): DROP TABLE IF EXISTS mr_registry;

-- Phase A: fail if normalized mr_key duplicates exist among active claims.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(regexp_replace(trim(mr_number), '\s+', ' ', 'g')) AS mr_key
      FROM emotive_claims
      WHERE deleted_at IS NULL
        AND mr_number IS NOT NULL
        AND trim(mr_number) <> ''
      UNION ALL
      SELECT lower(regexp_replace(trim(mr_number), '\s+', ' ', 'g')) AS mr_key
      FROM domace_claims
      WHERE deleted_at IS NULL
        AND mr_number IS NOT NULL
        AND trim(mr_number) <> ''
    ) normalized
    GROUP BY mr_key
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'mr_registry migration blocked: normalized mr_key duplicates among active claims';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "mr_registry" (
	"mr_key" text PRIMARY KEY NOT NULL,
	"claim_kind" text NOT NULL,
	"emotive_claim_id" uuid,
	"domace_claim_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mr_registry_claim_kind_check" CHECK ("mr_registry"."claim_kind" IN ('emotive', 'domace')),
	CONSTRAINT "mr_registry_one_of_claim_check" CHECK (
        ("mr_registry"."claim_kind" = 'emotive' AND "mr_registry"."emotive_claim_id" IS NOT NULL
         AND "mr_registry"."domace_claim_id" IS NULL)
        OR
        ("mr_registry"."claim_kind" = 'domace' AND "mr_registry"."emotive_claim_id" IS NULL
         AND "mr_registry"."domace_claim_id" IS NOT NULL)
      )
);
--> statement-breakpoint
ALTER TABLE "mr_registry" ADD CONSTRAINT "mr_registry_emotive_claim_id_fkey" FOREIGN KEY ("emotive_claim_id") REFERENCES "public"."emotive_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mr_registry" ADD CONSTRAINT "mr_registry_domace_claim_id_fkey" FOREIGN KEY ("domace_claim_id") REFERENCES "public"."domace_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mr_registry_emotive_claim_id_key" ON "mr_registry" USING btree ("emotive_claim_id") WHERE "mr_registry"."emotive_claim_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mr_registry_domace_claim_id_key" ON "mr_registry" USING btree ("domace_claim_id") WHERE "mr_registry"."domace_claim_id" IS NOT NULL;--> statement-breakpoint
-- Phase C: backfill active claims with non-empty mr_number (normalized mr_key).
INSERT INTO mr_registry (mr_key, claim_kind, emotive_claim_id, domace_claim_id, created_at)
SELECT
  lower(regexp_replace(trim(mr_number), '\s+', ' ', 'g')) AS mr_key,
  'emotive'::text AS claim_kind,
  id AS emotive_claim_id,
  NULL::uuid AS domace_claim_id,
  created_at
FROM emotive_claims
WHERE deleted_at IS NULL
  AND mr_number IS NOT NULL
  AND trim(mr_number) <> ''
UNION ALL
SELECT
  lower(regexp_replace(trim(mr_number), '\s+', ' ', 'g')) AS mr_key,
  'domace'::text AS claim_kind,
  NULL::uuid AS emotive_claim_id,
  id AS domace_claim_id,
  created_at
FROM domace_claims
WHERE deleted_at IS NULL
  AND mr_number IS NOT NULL
  AND trim(mr_number) <> '';
--> statement-breakpoint
-- Phase D: verify backfill row count matches eligible active claims.
DO $$
DECLARE
  expected_count integer;
  actual_count integer;
BEGIN
  SELECT COUNT(*) INTO expected_count
  FROM (
    SELECT id
    FROM emotive_claims
    WHERE deleted_at IS NULL
      AND mr_number IS NOT NULL
      AND trim(mr_number) <> ''
    UNION ALL
    SELECT id
    FROM domace_claims
    WHERE deleted_at IS NULL
      AND mr_number IS NOT NULL
      AND trim(mr_number) <> ''
  ) eligible;

  SELECT COUNT(*) INTO actual_count FROM mr_registry;

  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'mr_registry backfill count mismatch: expected %, got %',
      expected_count, actual_count;
  END IF;
END $$;
