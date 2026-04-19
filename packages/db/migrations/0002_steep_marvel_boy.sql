CREATE TABLE "claim_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"default_customer_id" uuid,
	"claim_number_prefix" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "engine_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"manufacturer" text,
	"displacement_cc" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "external_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "external_parties_kind_check" CHECK ("external_parties"."kind" IN ('supplier', 'subcontractor', 'manufacturer', 'other'))
);
--> statement-breakpoint
CREATE TABLE "client_registration_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"company_name" text,
	"message" text,
	"preferred_language" text DEFAULT 'sr' NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"linked_customer_id" uuid,
	"created_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	CONSTRAINT "client_registration_requests_preferred_language_check" CHECK ("client_registration_requests"."preferred_language" IN ('sr', 'en')),
	CONSTRAINT "client_registration_requests_status_check" CHECK ("client_registration_requests"."status" IN ('pending', 'approved', 'rejected', 'needs_info'))
);
--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_default_customer_id_fkey" FOREIGN KEY ("default_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_registration_requests" ADD CONSTRAINT "client_registration_requests_linked_customer_id_fkey" FOREIGN KEY ("linked_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_registration_requests" ADD CONSTRAINT "client_registration_requests_created_user_id_fkey" FOREIGN KEY ("created_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_registration_requests" ADD CONSTRAINT "client_registration_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claim_sources_code_key" ON "claim_sources" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "engine_types_code_key" ON "engine_types" USING btree ("code");