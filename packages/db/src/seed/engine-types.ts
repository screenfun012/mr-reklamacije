import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

export const CANONICAL_ENGINE_TYPE_CODES = [
  'BMW N47D20D',
  'Mercedes OM651',
  'Range rover 448DT',
  'Ford YMF',
  'Opel A20DTH',
] as const

export async function seedEngineTypes(db: NodePgDatabase<typeof schema>): Promise<void> {
  let inserted = 0

  for (const code of CANONICAL_ENGINE_TYPE_CODES) {
    const existing = await db
      .select({ id: schema.engineTypes.id })
      .from(schema.engineTypes)
      .where(eq(schema.engineTypes.code, code))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(schema.engineTypes).values({
        code,
        isActive: true,
      })
      inserted++
    }
  }

  console.log(
    `[seed:engine-types] Inserted ${inserted} / ${CANONICAL_ENGINE_TYPE_CODES.length} engine types`,
  )
}
