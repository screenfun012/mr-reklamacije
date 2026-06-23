CREATE TABLE "claim_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_kind" text NOT NULL,
	"emotive_claim_id" uuid,
	"domace_claim_id" uuid,
	"content_json" jsonb NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_reports_claim_kind_check" CHECK ("claim_kind" IN ('emotive', 'domace')),
	CONSTRAINT "claim_reports_one_of_claim_check" CHECK (
		("claim_kind" = 'emotive' AND "emotive_claim_id" IS NOT NULL AND "domace_claim_id" IS NULL)
		OR
		("claim_kind" = 'domace' AND "emotive_claim_id" IS NULL AND "domace_claim_id" IS NOT NULL)
	),
	CONSTRAINT "claim_reports_status_check" CHECK ("status" IN ('draft'))
);
--> statement-breakpoint
ALTER TABLE "claim_reports" ADD CONSTRAINT "claim_reports_emotive_claim_id_fkey" FOREIGN KEY ("emotive_claim_id") REFERENCES "public"."emotive_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_reports" ADD CONSTRAINT "claim_reports_domace_claim_id_fkey" FOREIGN KEY ("domace_claim_id") REFERENCES "public"."domace_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_reports" ADD CONSTRAINT "claim_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_reports" ADD CONSTRAINT "claim_reports_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_claim_reports_emotive_claim_id" ON "claim_reports" USING btree ("emotive_claim_id") WHERE "claim_reports"."emotive_claim_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_claim_reports_domace_claim_id" ON "claim_reports" USING btree ("domace_claim_id") WHERE "claim_reports"."domace_claim_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_reports_emotive_claim_id_key" ON "claim_reports" USING btree ("emotive_claim_id") WHERE "claim_reports"."emotive_claim_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_reports_domace_claim_id_key" ON "claim_reports" USING btree ("domace_claim_id") WHERE "claim_reports"."domace_claim_id" IS NOT NULL;
