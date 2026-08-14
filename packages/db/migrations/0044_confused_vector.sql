ALTER TABLE "intake_orders" ADD COLUMN "handover_technician_id" uuid;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "handover_technician_signature" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "handover_owner_signature" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "handover_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "handover_document_storage_path" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "handover_document_sha256" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "handover_document_emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD CONSTRAINT "intake_orders_handover_technician_id_fkey" FOREIGN KEY ("handover_technician_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;