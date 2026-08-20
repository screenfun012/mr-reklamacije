CREATE TABLE "claim_categories" (
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
ALTER TABLE "domace_claims" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD COLUMN "category_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_categories_code_key" ON "claim_categories" USING btree ("code");--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."claim_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD CONSTRAINT "emotive_claims_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."claim_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_domace_claims_category_id" ON "domace_claims" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_category_id" ON "emotive_claims" USING btree ("category_id");--> statement-breakpoint
INSERT INTO "claim_categories" ("code", "name", "sort_order") VALUES
  ('REMONT_MOTORA', 'Generalni remont motora', 10),
  ('MASINSKA_OBRADA', 'Mašinska obrada', 20),
  ('NOVI_DELOVI', 'Novi delovi', 30),
  ('AUTO_SERVIS', 'Auto-servis', 40)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
UPDATE "emotive_claims"
SET "category_id" = (SELECT "id" FROM "claim_categories" WHERE "code" = 'REMONT_MOTORA')
WHERE "category_id" IS NULL;
--> statement-breakpoint
UPDATE "domace_claims"
SET "category_id" = (SELECT "id" FROM "claim_categories" WHERE "code" = 'REMONT_MOTORA')
WHERE "category_id" IS NULL;
