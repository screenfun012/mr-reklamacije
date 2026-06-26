ALTER TABLE "users" ADD COLUMN "account_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE "users" SET "account_status" = 'approved';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_account_status_check" CHECK ("account_status" IN ('pending', 'approved', 'rejected'));
