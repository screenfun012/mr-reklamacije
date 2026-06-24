CREATE TABLE "engine_manufacturers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "engine_manufacturers_code_key" ON "engine_manufacturers" USING btree ("code");--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD COLUMN "manufacturer_id" uuid;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "manufacturer_id" uuid;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD CONSTRAINT "emotive_claims_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."engine_manufacturers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."engine_manufacturers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_manufacturer_id" ON "emotive_claims" USING btree ("manufacturer_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_manufacturer_id_claim_year" ON "emotive_claims" USING btree ("manufacturer_id","claim_year");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_manufacturer_id" ON "domace_claims" USING btree ("manufacturer_id");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_manufacturer_id_claim_year" ON "domace_claims" USING btree ("manufacturer_id","claim_year");
