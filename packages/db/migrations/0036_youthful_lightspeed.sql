CREATE TABLE "intake_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"order_number_key" text NOT NULL,
	"status" text DEFAULT 'primljeno' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"technician_id" uuid NOT NULL,
	"vehicle_type" text DEFAULT 'auto' NOT NULL,
	"plate" text NOT NULL,
	"plate_key" text NOT NULL,
	"vehicle" text NOT NULL,
	"vin" text,
	"mileage" integer,
	"arrival_mode" text NOT NULL,
	"owner_name" text NOT NULL,
	"owner_address" text,
	"owner_phone" text NOT NULL,
	"owner_remarks" text,
	"fuel_level" integer DEFAULT 4 NOT NULL,
	"checklist" jsonb NOT NULL,
	"equipment_note" text,
	"damages" jsonb NOT NULL,
	"services" jsonb NOT NULL,
	"materials" jsonb NOT NULL,
	"draft_step" integer,
	"photos_expected" integer,
	"technician_signature" text,
	"owner_signature" text,
	"signed_at" timestamp with time zone,
	"amended_at" timestamp with time zone,
	"amended_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "intake_orders_status_check" CHECK ("intake_orders"."status" IN ('primljeno', 'u_radu', 'gotovo', 'preuzeto')),
	CONSTRAINT "intake_orders_vehicle_type_check" CHECK ("intake_orders"."vehicle_type" IN ('auto', 'kombi', 'kamionet', 'dzip')),
	CONSTRAINT "intake_orders_arrival_mode_check" CHECK ("intake_orders"."arrival_mode" IN ('dovezeno', 'doslepano', 'dovuceno')),
	CONSTRAINT "intake_orders_fuel_level_check" CHECK ("intake_orders"."fuel_level" BETWEEN 0 AND 8),
	CONSTRAINT "intake_orders_draft_step_check" CHECK ("intake_orders"."draft_step" BETWEEN 1 AND 5),
	CONSTRAINT "intake_orders_photos_expected_check" CHECK ("intake_orders"."photos_expected" >= 0),
	CONSTRAINT "intake_orders_mileage_check" CHECK ("intake_orders"."mileage" >= 0)
);
--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_one_of_claim_check";--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "intake_order_id" uuid;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "intake_damage_id" text;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD CONSTRAINT "intake_orders_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_orders" ADD CONSTRAINT "intake_orders_amended_by_fkey" FOREIGN KEY ("amended_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_intake_orders_order_number_key" ON "intake_orders" USING btree ("order_number_key") WHERE "intake_orders"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_intake_orders_plate_key" ON "intake_orders" USING btree ("plate_key");--> statement-breakpoint
CREATE INDEX "idx_intake_orders_status" ON "intake_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_intake_orders_received_at" ON "intake_orders" USING btree ("received_at" DESC NULLS LAST) WHERE "intake_orders"."deleted_at" IS NULL AND "intake_orders"."signed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_intake_orders_technician_id" ON "intake_orders" USING btree ("technician_id");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_intake_order_id_fkey" FOREIGN KEY ("intake_order_id") REFERENCES "public"."intake_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_intake_order_id" ON "attachments" USING btree ("intake_order_id") WHERE "attachments"."intake_order_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_intake_damage_requires_order_check" CHECK ("attachments"."intake_damage_id" IS NULL OR "attachments"."intake_order_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_of_claim_check" CHECK (
        ("attachments"."claim_kind" = 'emotive' AND "attachments"."emotive_claim_id" IS NOT NULL
         AND "attachments"."domace_claim_id" IS NULL AND "attachments"."client_submission_id" IS NULL
         AND "attachments"."intake_order_id" IS NULL)
        OR
        ("attachments"."claim_kind" = 'domace' AND "attachments"."emotive_claim_id" IS NULL
         AND "attachments"."domace_claim_id" IS NOT NULL AND "attachments"."client_submission_id" IS NULL
         AND "attachments"."intake_order_id" IS NULL)
        OR
        ("attachments"."claim_kind" IS NULL AND "attachments"."client_submission_id" IS NOT NULL
         AND "attachments"."emotive_claim_id" IS NULL AND "attachments"."domace_claim_id" IS NULL
         AND "attachments"."intake_order_id" IS NULL)
        OR
        ("attachments"."claim_kind" IS NULL AND "attachments"."intake_order_id" IS NOT NULL
         AND "attachments"."emotive_claim_id" IS NULL AND "attachments"."domace_claim_id" IS NULL
         AND "attachments"."client_submission_id" IS NULL)
      );