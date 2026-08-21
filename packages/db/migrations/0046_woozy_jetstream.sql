CREATE TABLE "claim_category_field_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "claim_category_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"field_type" text DEFAULT 'select' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "claim_category_fields_field_type_check" CHECK ("claim_category_fields"."field_type" IN ('select'))
);
--> statement-breakpoint
ALTER TABLE "claim_categories" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "category_field_values" jsonb;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD COLUMN "category_field_values" jsonb;--> statement-breakpoint
ALTER TABLE "claim_category_field_options" ADD CONSTRAINT "claim_category_field_options_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."claim_category_fields"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_category_fields" ADD CONSTRAINT "claim_category_fields_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."claim_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_category_field_options_field_code_key" ON "claim_category_field_options" USING btree ("field_id","code");--> statement-breakpoint
CREATE INDEX "idx_claim_category_field_options_field_id" ON "claim_category_field_options" USING btree ("field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_category_fields_category_code_key" ON "claim_category_fields" USING btree ("category_id","code");--> statement-breakpoint
CREATE INDEX "idx_claim_category_fields_category_id" ON "claim_category_fields" USING btree ("category_id");--> statement-breakpoint
INSERT INTO "claim_category_fields" ("category_id", "code", "name", "field_type", "sort_order")
SELECT "id", 'obradjeni_deo', 'Obrađeni deo', 'select', 10
FROM "claim_categories"
WHERE "code" = 'MASINSKA_OBRADA'
ON CONFLICT ("category_id", "code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "claim_category_field_options" ("field_id", "code", "name", "sort_order")
SELECT f."id", v.code, v.name, v.sort_order
FROM "claim_category_fields" f
JOIN "claim_categories" c ON c."id" = f."category_id"
CROSS JOIN (VALUES ('glava', 'Glava', 10), ('blok', 'Blok', 20), ('radilica', 'Radilica', 30)) AS v(code, name, sort_order)
WHERE c."code" = 'MASINSKA_OBRADA' AND f."code" = 'obradjeni_deo'
ON CONFLICT ("field_id", "code") DO NOTHING;
