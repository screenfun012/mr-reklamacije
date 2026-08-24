ALTER TABLE "attachments" DROP CONSTRAINT "attachments_one_of_claim_check";--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_purpose_check";--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "chat_message_id" uuid;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_chat_message_id_fkey" FOREIGN KEY ("chat_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_chat_message_id" ON "attachments" USING btree ("chat_message_id") WHERE "attachments"."chat_message_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_of_claim_check" CHECK (
        ("attachments"."claim_kind" = 'emotive' AND "attachments"."emotive_claim_id" IS NOT NULL
         AND "attachments"."domace_claim_id" IS NULL AND "attachments"."client_submission_id" IS NULL
         AND "attachments"."intake_order_id" IS NULL AND "attachments"."chat_message_id" IS NULL)
        OR
        ("attachments"."claim_kind" = 'domace' AND "attachments"."emotive_claim_id" IS NULL
         AND "attachments"."domace_claim_id" IS NOT NULL AND "attachments"."client_submission_id" IS NULL
         AND "attachments"."intake_order_id" IS NULL AND "attachments"."chat_message_id" IS NULL)
        OR
        ("attachments"."claim_kind" IS NULL AND "attachments"."client_submission_id" IS NOT NULL
         AND "attachments"."emotive_claim_id" IS NULL AND "attachments"."domace_claim_id" IS NULL
         AND "attachments"."intake_order_id" IS NULL AND "attachments"."chat_message_id" IS NULL)
        OR
        ("attachments"."claim_kind" IS NULL AND "attachments"."intake_order_id" IS NOT NULL
         AND "attachments"."emotive_claim_id" IS NULL AND "attachments"."domace_claim_id" IS NULL
         AND "attachments"."client_submission_id" IS NULL AND "attachments"."chat_message_id" IS NULL)
        OR
        ("attachments"."claim_kind" IS NULL AND "attachments"."chat_message_id" IS NOT NULL
         AND "attachments"."emotive_claim_id" IS NULL AND "attachments"."domace_claim_id" IS NULL
         AND "attachments"."client_submission_id" IS NULL AND "attachments"."intake_order_id" IS NULL)
      );--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_purpose_check" CHECK ("attachments"."purpose" IN ('claim_attachment', 'report_image', 'intake_quote', 'chat_attachment'));