ALTER TABLE "emotive_claims" ALTER COLUMN "warranty_report" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "emotive_claims" ALTER COLUMN "employee_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "emotive_claims" ALTER COLUMN "source_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD COLUMN "engine_code" text;