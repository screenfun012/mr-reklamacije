CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_kind" text NOT NULL,
	"emotive_claim_id" uuid,
	"domace_claim_id" uuid,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"thumbnail_path" text,
	"caption" text,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "attachments_claim_kind_check" CHECK ("attachments"."claim_kind" IN ('emotive', 'domace')),
	CONSTRAINT "attachments_one_of_claim_check" CHECK (
        ("attachments"."claim_kind" = 'emotive' AND "attachments"."emotive_claim_id" IS NOT NULL
         AND "attachments"."domace_claim_id" IS NULL)
        OR
        ("attachments"."claim_kind" = 'domace' AND "attachments"."emotive_claim_id" IS NULL
         AND "attachments"."domace_claim_id" IS NOT NULL)
      ),
	CONSTRAINT "attachments_visibility_check" CHECK ("attachments"."visibility" IN ('internal', 'client_visible'))
);
--> statement-breakpoint
CREATE TABLE "claim_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_kind" text NOT NULL,
	"emotive_claim_id" uuid,
	"domace_claim_id" uuid,
	"body" text NOT NULL,
	"visibility" text NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "claim_observations_claim_kind_check" CHECK ("claim_observations"."claim_kind" IN ('emotive', 'domace')),
	CONSTRAINT "claim_observations_one_of_claim_check" CHECK (
        ("claim_observations"."claim_kind" = 'emotive' AND "claim_observations"."emotive_claim_id" IS NOT NULL
         AND "claim_observations"."domace_claim_id" IS NULL)
        OR
        ("claim_observations"."claim_kind" = 'domace' AND "claim_observations"."emotive_claim_id" IS NULL
         AND "claim_observations"."domace_claim_id" IS NOT NULL)
      ),
	CONSTRAINT "claim_observations_visibility_check" CHECK ("claim_observations"."visibility" IN ('internal', 'client_visible'))
);
--> statement-breakpoint
CREATE TABLE "translation_cache" (
	"source_hash" text NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"source_text" text NOT NULL,
	"translated_text" text NOT NULL,
	"model" text NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"access_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "translation_cache_source_hash_source_language_target_language_pk" PRIMARY KEY("source_hash","source_language","target_language")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"value_type" text NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "app_settings_value_type_check" CHECK ("app_settings"."value_type" IN ('string', 'number', 'boolean', 'json'))
);
--> statement-breakpoint
CREATE TABLE "employee_monthly_output" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"engines_assembled" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "employee_monthly_output_month_check" CHECK ("employee_monthly_output"."month" >= 1 AND "employee_monthly_output"."month" <= 12)
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_emotive_claim_id_fkey" FOREIGN KEY ("emotive_claim_id") REFERENCES "public"."emotive_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_domace_claim_id_fkey" FOREIGN KEY ("domace_claim_id") REFERENCES "public"."domace_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_observations" ADD CONSTRAINT "claim_observations_emotive_claim_id_fkey" FOREIGN KEY ("emotive_claim_id") REFERENCES "public"."emotive_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_observations" ADD CONSTRAINT "claim_observations_domace_claim_id_fkey" FOREIGN KEY ("domace_claim_id") REFERENCES "public"."domace_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_observations" ADD CONSTRAINT "claim_observations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_monthly_output" ADD CONSTRAINT "employee_monthly_output_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_monthly_output" ADD CONSTRAINT "employee_monthly_output_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_monthly_output" ADD CONSTRAINT "employee_monthly_output_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_uploaded_at" ON "attachments" USING btree ("uploaded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_attachments_emotive_claim_id" ON "attachments" USING btree ("emotive_claim_id") WHERE "attachments"."emotive_claim_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_attachments_domace_claim_id" ON "attachments" USING btree ("domace_claim_id") WHERE "attachments"."domace_claim_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_claim_observations_emotive_claim_id" ON "claim_observations" USING btree ("emotive_claim_id") WHERE "claim_observations"."emotive_claim_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_claim_observations_domace_claim_id" ON "claim_observations" USING btree ("domace_claim_id") WHERE "claim_observations"."domace_claim_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_translation_cache_last_accessed_at" ON "translation_cache" USING btree ("last_accessed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_monthly_output_employee_id_year_month_key" ON "employee_monthly_output" USING btree ("employee_id","year","month");--> statement-breakpoint
CREATE INDEX "idx_employee_monthly_output_employee_year_month" ON "employee_monthly_output" USING btree ("employee_id","year","month" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_employee_monthly_output_year_month" ON "employee_monthly_output" USING btree ("year","month");