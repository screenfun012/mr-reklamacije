CREATE TABLE "client_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"linked_emotive_claim_id" uuid,
	"rejected_reason" text,
	"handled_by_user_id" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "client_submissions_status_check" CHECK ("client_submissions"."status" IN ('pending', 'converted', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_one_of_claim_check";--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "claim_kind" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "client_submission_id" uuid;--> statement-breakpoint
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_linked_emotive_claim_id_fkey" FOREIGN KEY ("linked_emotive_claim_id") REFERENCES "public"."emotive_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_submissions" ADD CONSTRAINT "client_submissions_handled_by_user_id_fkey" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_submissions_customer_id" ON "client_submissions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_client_submissions_status" ON "client_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_client_submissions_created_at" ON "client_submissions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_client_submission_id_fkey" FOREIGN KEY ("client_submission_id") REFERENCES "public"."client_submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_client_submission_id" ON "attachments" USING btree ("client_submission_id") WHERE "attachments"."client_submission_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_of_claim_check" CHECK (
        ("attachments"."claim_kind" = 'emotive' AND "attachments"."emotive_claim_id" IS NOT NULL
         AND "attachments"."domace_claim_id" IS NULL AND "attachments"."client_submission_id" IS NULL)
        OR
        ("attachments"."claim_kind" = 'domace' AND "attachments"."emotive_claim_id" IS NULL
         AND "attachments"."domace_claim_id" IS NOT NULL AND "attachments"."client_submission_id" IS NULL)
        OR
        ("attachments"."claim_kind" IS NULL AND "attachments"."client_submission_id" IS NOT NULL
         AND "attachments"."emotive_claim_id" IS NULL AND "attachments"."domace_claim_id" IS NULL)
      );