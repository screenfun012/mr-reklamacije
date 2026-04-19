CREATE TABLE "domace_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number_yearly" integer NOT NULL,
	"date_received" date NOT NULL,
	"customer_id" uuid,
	"customer_name_snapshot" text NOT NULL,
	"vehicle" text NOT NULL,
	"work_order" text NOT NULL,
	"old_work_order" text,
	"original_invoice_amount" numeric(14, 2),
	"invoice_number" text,
	"problem_description" text NOT NULL,
	"outcome" text NOT NULL,
	"parts_amount_no_vat" numeric(14, 2),
	"labor_amount_no_vat" numeric(14, 2),
	"total_amount" numeric(14, 2),
	"assigned_employee_id" uuid,
	"fault_department_id" uuid,
	"notes" text,
	"internal_notes" text,
	"claim_year" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "domace_claims_outcome_check" CHECK ("domace_claims"."outcome" IN ('pending', 'accepted', 'rejected', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "emotive_claim_faults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"fault_type" text NOT NULL,
	"employee_id" uuid,
	"department_id" uuid,
	"external_party_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emotive_claim_faults_fault_type_check" CHECK ("emotive_claim_faults"."fault_type" IN ('employee', 'department', 'external')),
	CONSTRAINT "emotive_claim_faults_one_of_check" CHECK (
        ("emotive_claim_faults"."fault_type" = 'employee' AND "emotive_claim_faults"."employee_id" IS NOT NULL
          AND "emotive_claim_faults"."department_id" IS NULL AND "emotive_claim_faults"."external_party_id" IS NULL)
        OR
        ("emotive_claim_faults"."fault_type" = 'department' AND "emotive_claim_faults"."employee_id" IS NULL
          AND "emotive_claim_faults"."department_id" IS NOT NULL AND "emotive_claim_faults"."external_party_id" IS NULL)
        OR
        ("emotive_claim_faults"."fault_type" = 'external' AND "emotive_claim_faults"."employee_id" IS NULL
          AND "emotive_claim_faults"."department_id" IS NULL AND "emotive_claim_faults"."external_party_id" IS NOT NULL)
      )
);
--> statement-breakpoint
CREATE TABLE "emotive_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" bigserial NOT NULL,
	"claim_number" text,
	"warranty_report" text NOT NULL,
	"engine_type_id" uuid NOT NULL,
	"date_of_claim" date NOT NULL,
	"mr_number" text NOT NULL,
	"date_of_finish" date,
	"employee_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"claim_year" integer NOT NULL,
	"customer_id" uuid,
	"internal_notes" text,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "emotive_claims_sequence_number_unique" UNIQUE("sequence_number"),
	CONSTRAINT "emotive_claims_outcome_check" CHECK ("emotive_claims"."outcome" IN ('pending', 'accepted', 'rejected', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_fault_department_id_fkey" FOREIGN KEY ("fault_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claim_faults" ADD CONSTRAINT "emotive_claim_faults_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."emotive_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claim_faults" ADD CONSTRAINT "emotive_claim_faults_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claim_faults" ADD CONSTRAINT "emotive_claim_faults_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claim_faults" ADD CONSTRAINT "emotive_claim_faults_external_party_id_fkey" FOREIGN KEY ("external_party_id") REFERENCES "public"."external_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD CONSTRAINT "emotive_claims_engine_type_id_fkey" FOREIGN KEY ("engine_type_id") REFERENCES "public"."engine_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD CONSTRAINT "emotive_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD CONSTRAINT "emotive_claims_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."claim_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD CONSTRAINT "emotive_claims_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD CONSTRAINT "emotive_claims_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD CONSTRAINT "emotive_claims_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_domace_claims_date_received" ON "domace_claims" USING btree ("date_received" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_domace_claims_claim_year_outcome" ON "domace_claims" USING btree ("claim_year","outcome");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_customer_id" ON "domace_claims" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_assigned_employee_claim_year" ON "domace_claims" USING btree ("assigned_employee_id","claim_year");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_fault_department_claim_year" ON "domace_claims" USING btree ("fault_department_id","claim_year");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_problem_customer_fts" ON "domace_claims" USING gin (to_tsvector('simple', coalesce("problem_description", '') || ' ' || coalesce("customer_name_snapshot", '')));--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_date_of_claim" ON "emotive_claims" USING btree ("date_of_claim" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_claim_year_outcome" ON "emotive_claims" USING btree ("claim_year","outcome");--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_employee_id_claim_year" ON "emotive_claims" USING btree ("employee_id","claim_year");--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_source_id" ON "emotive_claims" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_customer_id" ON "emotive_claims" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_engine_type_id" ON "emotive_claims" USING btree ("engine_type_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_warranty_report_fts" ON "emotive_claims" USING gin (to_tsvector('simple', "warranty_report"));