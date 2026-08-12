ALTER TABLE "intake_orders" ADD COLUMN "owner_type" text DEFAULT 'fizicko_lice' NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "owner_id_number" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "owner_email" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD CONSTRAINT "intake_orders_owner_type_check" CHECK ("intake_orders"."owner_type" IN ('fizicko_lice', 'firma'));