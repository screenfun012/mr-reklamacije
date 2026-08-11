ALTER TABLE "intake_orders" DROP CONSTRAINT "intake_orders_amended_by_fkey";
--> statement-breakpoint
ALTER TABLE "intake_orders" DROP COLUMN "amended_at";--> statement-breakpoint
ALTER TABLE "intake_orders" DROP COLUMN "amended_by";