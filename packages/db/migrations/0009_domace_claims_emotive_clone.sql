CREATE TABLE "domace_claim_faults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"fault_type" text NOT NULL,
	"employee_id" uuid,
	"department_id" uuid,
	"external_party_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domace_claim_faults_fault_type_check" CHECK ("domace_claim_faults"."fault_type" IN ('employee', 'department', 'external')),
	CONSTRAINT "domace_claim_faults_one_of_check" CHECK (
        ("domace_claim_faults"."fault_type" = 'employee' AND "domace_claim_faults"."employee_id" IS NOT NULL
          AND "domace_claim_faults"."department_id" IS NULL AND "domace_claim_faults"."external_party_id" IS NULL)
        OR
        ("domace_claim_faults"."fault_type" = 'department' AND "domace_claim_faults"."employee_id" IS NULL
          AND "domace_claim_faults"."department_id" IS NOT NULL AND "domace_claim_faults"."external_party_id" IS NULL)
        OR
        ("domace_claim_faults"."fault_type" = 'external' AND "domace_claim_faults"."employee_id" IS NULL
          AND "domace_claim_faults"."department_id" IS NULL AND "domace_claim_faults"."external_party_id" IS NOT NULL)
      )
);
--> statement-breakpoint
ALTER TABLE "domace_claims" DROP CONSTRAINT "domace_claims_customer_id_fkey";
--> statement-breakpoint
ALTER TABLE "domace_claims" DROP CONSTRAINT "domace_claims_assigned_employee_id_fkey";
--> statement-breakpoint
ALTER TABLE "domace_claims" DROP CONSTRAINT "domace_claims_fault_department_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_domace_claims_date_received";--> statement-breakpoint
DROP INDEX "idx_domace_claims_customer_id";--> statement-breakpoint
DROP INDEX "idx_domace_claims_assigned_employee_claim_year";--> statement-breakpoint
DROP INDEX "idx_domace_claims_fault_department_claim_year";--> statement-breakpoint
DROP INDEX "idx_domace_claims_problem_customer_fts";--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "sequence_number" bigserial NOT NULL;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "claim_number" text;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "warranty_report" text;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "engine_type_id" uuid;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "engine_code" text;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "date_of_claim" date;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "mr_number" text;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "date_of_finish" date;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD COLUMN "employee_id" uuid;--> statement-breakpoint
ALTER TABLE "domace_claim_faults" ADD CONSTRAINT "domace_claim_faults_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."domace_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claim_faults" ADD CONSTRAINT "domace_claim_faults_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claim_faults" ADD CONSTRAINT "domace_claim_faults_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claim_faults" ADD CONSTRAINT "domace_claim_faults_external_party_id_fkey" FOREIGN KEY ("external_party_id") REFERENCES "public"."external_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_engine_type_id_fkey" FOREIGN KEY ("engine_type_id") REFERENCES "public"."engine_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_domace_claims_date_of_claim" ON "domace_claims" USING btree ("date_of_claim" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_domace_claims_date_of_claim_id" ON "domace_claims" USING btree ("date_of_claim" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_domace_claims_employee_id_claim_year" ON "domace_claims" USING btree ("employee_id","claim_year");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_engine_type_id" ON "domace_claims" USING btree ("engine_type_id");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_warranty_customer_fts" ON "domace_claims" USING gin (to_tsvector('simple', coalesce("warranty_report", '') || ' ' || coalesce("customer_name", '')));--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "sequence_number_yearly";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "date_received";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "customer_id";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "customer_name_snapshot";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "vehicle";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "work_order";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "old_work_order";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "original_invoice_amount";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "invoice_number";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "problem_description";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "parts_amount_no_vat";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "labor_amount_no_vat";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "assigned_employee_id";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "fault_department_id";--> statement-breakpoint
ALTER TABLE "domace_claims" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "domace_claims" ADD CONSTRAINT "domace_claims_sequence_number_unique" UNIQUE("sequence_number");