ALTER TABLE "departments" ADD COLUMN "provides_assigned_workers" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Assembly is the source of "assigned workers" today, so its workers keep populating
-- that dropdown after this migration; admin can flag more departments from the UI.
UPDATE "departments" SET "provides_assigned_workers" = true WHERE "code" = 'SKLAPANJE';