ALTER TABLE "intake_orders" ADD COLUMN "document_storage_path" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "document_sha256" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "document_emailed_at" timestamp with time zone;