ALTER TABLE "engine_types" ADD COLUMN "manufacturer_id" uuid;--> statement-breakpoint
UPDATE "engine_types" AS et
SET "manufacturer_id" = em."id"
FROM "engine_manufacturers" AS em
WHERE et."deleted_at" IS NULL
  AND et."manufacturer_id" IS NULL
  AND (
    (et."code" = 'BMW N47D20D' AND em."code" = 'BMW') OR
    (et."code" = 'Mercedes OM651' AND em."code" = 'MERCEDES_BENZ') OR
    (et."code" = 'Range rover 448DT' AND em."code" = 'LAND_ROVER') OR
    (et."code" = 'Ford YMF' AND em."code" = 'FORD') OR
    (et."code" = 'Opel A20DTH' AND em."code" = 'OPEL')
  );--> statement-breakpoint
ALTER TABLE "engine_types" ADD CONSTRAINT "engine_types_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."engine_manufacturers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_engine_types_manufacturer_id" ON "engine_types" USING btree ("manufacturer_id");--> statement-breakpoint
ALTER TABLE "engine_types" DROP COLUMN "manufacturer";
