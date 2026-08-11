DROP INDEX "uq_intake_orders_order_number_key";--> statement-breakpoint
DROP INDEX "idx_intake_orders_received_at";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_intake_orders_order_number_key" ON "intake_orders" USING btree ("order_number_key");--> statement-breakpoint
CREATE INDEX "idx_intake_orders_received_at" ON "intake_orders" USING btree ("received_at" DESC NULLS LAST) WHERE "intake_orders"."signed_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_orders" DROP COLUMN "deleted_at";