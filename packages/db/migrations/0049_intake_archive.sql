ALTER TABLE "intake_orders" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD CONSTRAINT "intake_orders_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;