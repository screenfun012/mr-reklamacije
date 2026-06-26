import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

export interface CanonicalEngineTypeSeed {
  code: string
  manufacturerCode: string
}

export const CANONICAL_ENGINE_TYPE_SEEDS: readonly CanonicalEngineTypeSeed[] = [
  { code: 'BMW N47D20D', manufacturerCode: 'BMW' },
  { code: 'Mercedes OM651', manufacturerCode: 'MERCEDES_BENZ' },
  { code: 'Range rover 448DT', manufacturerCode: 'LAND_ROVER' },
  { code: 'Ford YMF', manufacturerCode: 'FORD' },
  { code: 'Opel A20DTH', manufacturerCode: 'OPEL' },
] as const

/** @deprecated Use CANONICAL_ENGINE_TYPE_SEEDS */
export const CANONICAL_ENGINE_TYPE_CODES = CANONICAL_ENGINE_TYPE_SEEDS.map((seed) => seed.code)

export async function seedEngineTypes(db: NodePgDatabase<typeof schema>): Promise<void> {
  let inserted = 0
  let linked = 0

  for (const seed of CANONICAL_ENGINE_TYPE_SEEDS) {
    const [manufacturer] = await db
      .select({ id: schema.engineManufacturers.id })
      .from(schema.engineManufacturers)
      .where(eq(schema.engineManufacturers.code, seed.manufacturerCode))
      .limit(1)

    if (manufacturer === undefined) {
      console.warn(
        `[seed:engine-types] Skipping ${seed.code}: manufacturer ${seed.manufacturerCode} not found`,
      )
      continue
    }

    const [existing] = await db
      .select({
        id: schema.engineTypes.id,
        manufacturerId: schema.engineTypes.manufacturerId,
      })
      .from(schema.engineTypes)
      .where(eq(schema.engineTypes.code, seed.code))
      .limit(1)

    if (existing === undefined) {
      await db.insert(schema.engineTypes).values({
        code: seed.code,
        manufacturerId: manufacturer.id,
        isActive: true,
      })
      inserted++
      continue
    }

    if (existing.manufacturerId !== manufacturer.id) {
      await db
        .update(schema.engineTypes)
        .set({ manufacturerId: manufacturer.id })
        .where(eq(schema.engineTypes.id, existing.id))
      linked++
    }
  }

  console.log(
    `[seed:engine-types] Inserted ${inserted}, linked ${linked} / ${CANONICAL_ENGINE_TYPE_SEEDS.length} canonical engine types`,
  )
}
