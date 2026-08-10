CREATE TABLE "intake_arrival_modes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_sr" text NOT NULL,
	"name_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "intake_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_sr" text NOT NULL,
	"name_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "intake_damage_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_sr" text NOT NULL,
	"name_en" text NOT NULL,
	"marker_tone" text DEFAULT 'red' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "intake_damage_types_marker_tone_check" CHECK ("intake_damage_types"."marker_tone" IN ('red', 'amber', 'grey', 'green'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "intake_arrival_modes_code_key" ON "intake_arrival_modes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_checklist_items_code_key" ON "intake_checklist_items" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_damage_types_code_key" ON "intake_damage_types" USING btree ("code");