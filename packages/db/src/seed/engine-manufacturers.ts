import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

interface EngineManufacturerSeed {
  code: string
  name: string
  sortOrder: number
}

export const CANONICAL_ENGINE_MANUFACTURERS: EngineManufacturerSeed[] = [
  { code: 'BMW', name: 'BMW', sortOrder: 10 },
  { code: 'MERCEDES_BENZ', name: 'Mercedes-Benz', sortOrder: 20 },
  { code: 'AUDI', name: 'Audi', sortOrder: 30 },
  { code: 'VOLKSWAGEN', name: 'Volkswagen', sortOrder: 40 },
  { code: 'FORD', name: 'Ford', sortOrder: 50 },
  { code: 'OPEL', name: 'Opel', sortOrder: 60 },
  { code: 'RENAULT', name: 'Renault', sortOrder: 70 },
  { code: 'PEUGEOT', name: 'Peugeot', sortOrder: 80 },
  { code: 'CITROEN', name: 'Citroën', sortOrder: 90 },
  { code: 'FIAT', name: 'Fiat', sortOrder: 100 },
  { code: 'VOLVO', name: 'Volvo', sortOrder: 110 },
  { code: 'LAND_ROVER', name: 'Land Rover', sortOrder: 120 },
  { code: 'TOYOTA', name: 'Toyota', sortOrder: 130 },
  { code: 'HONDA', name: 'Honda', sortOrder: 140 },
  { code: 'NISSAN', name: 'Nissan', sortOrder: 150 },
  { code: 'HYUNDAI', name: 'Hyundai', sortOrder: 160 },
  { code: 'KIA', name: 'Kia', sortOrder: 170 },
  { code: 'IVECO', name: 'Iveco', sortOrder: 180 },
  { code: 'MAN', name: 'MAN', sortOrder: 190 },
  { code: 'DAF', name: 'DAF', sortOrder: 200 },
  { code: 'CUMMINS', name: 'Cummins', sortOrder: 210 },
  { code: 'DACIA', name: 'Dacia', sortOrder: 213 },
  { code: 'SKODA', name: 'Škoda', sortOrder: 216 },
  { code: 'OSTALO', name: 'Ostalo', sortOrder: 220 },
]

export async function seedEngineManufacturers(db: NodePgDatabase<typeof schema>): Promise<void> {
  const inserted = await db
    .insert(schema.engineManufacturers)
    .values(CANONICAL_ENGINE_MANUFACTURERS)
    .onConflictDoNothing({ target: schema.engineManufacturers.code })
    .returning({ code: schema.engineManufacturers.code })

  console.log(
    `[seed:engine-manufacturers] Inserted ${inserted.length} / ${CANONICAL_ENGINE_MANUFACTURERS.length} engine manufacturers`,
  )
}
