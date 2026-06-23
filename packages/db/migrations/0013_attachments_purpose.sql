ALTER TABLE "attachments" ADD COLUMN "purpose" text DEFAULT 'claim_attachment' NOT NULL;
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_purpose_check" CHECK ("purpose" IN ('claim_attachment', 'report_image'));
--> statement-breakpoint
CREATE INDEX "idx_attachments_claim_purpose" ON "attachments" USING btree ("claim_kind","purpose") WHERE "deleted_at" IS NULL;
