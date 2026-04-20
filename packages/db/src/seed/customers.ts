import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

const EMOTIVE_PARTNERS = [
  'MR ENGINES',
  'MRT POLSKA',
  'MRT VEGHEL',
  'OVERIGE',
  'NO NAME',
  'NEWPARTS',
  'VEGE TUNISIE',
  'HILLS',
  'TRENT',
  'ONBEKEND',
  'SELMAN',
  'VITOBELLO',
  'JONKER',
  'HMT',
] as const

export async function seedCustomers(db: NodePgDatabase<typeof schema>): Promise<void> {
  let inserted = 0

  for (const name of EMOTIVE_PARTNERS) {
    const existing = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.name, name))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(schema.customers).values({
        name,
        kind: 'emotive_partner',
        isActive: true,
      })
      inserted++
    }
  }

  console.log(
    `[seed:customers] Inserted ${inserted} / ${EMOTIVE_PARTNERS.length} EMOTIVE partners`,
  )
}
