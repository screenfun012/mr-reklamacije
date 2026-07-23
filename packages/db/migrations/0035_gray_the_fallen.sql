ALTER TABLE "domace_claims" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "original_invoice_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "parts_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "labor_amount" numeric(14, 2);