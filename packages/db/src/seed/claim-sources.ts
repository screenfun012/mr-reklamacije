import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

interface ClaimSourceSeed {
  code: string
  name: string
  claimNumberPrefix: string | null
  sortOrder: number
}

const CLAIM_SOURCES: ClaimSourceSeed[] = [
  {
    code: 'APPROVED_GREEN',
    name: 'APPROVED GREEN',
    claimNumberPrefix: 'RGC',
    sortOrder: 10,
  },
  { code: 'SELMAN', name: 'SELMAN', claimNumberPrefix: 'SEL', sortOrder: 20 },
  { code: 'VITOBELLO', name: 'VITOBELLO', claimNumberPrefix: 'VB', sortOrder: 30 },
  { code: 'JONKER', name: 'JONKER', claimNumberPrefix: null, sortOrder: 40 },
  { code: 'HMT', name: 'HMT', claimNumberPrefix: null, sortOrder: 50 },
  {
    code: 'HR_GEO_SUPPORT',
    name: 'HR GEO SUPPORT',
    claimNumberPrefix: null,
    sortOrder: 60,
  },
  {
    code: 'HR_MIROSLAV_VUJIC',
    name: 'HR MIROSLAV VUJIC',
    claimNumberPrefix: null,
    sortOrder: 70,
  },
  { code: 'AUTO_STANIC', name: 'AUTO STANIC', claimNumberPrefix: null, sortOrder: 80 },
]

export async function seedClaimSources(db: NodePgDatabase<typeof schema>): Promise<void> {
  let inserted = 0

  for (const source of CLAIM_SOURCES) {
    const [customer] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(eq(schema.customers.name, source.name))
      .limit(1)

    const insertedRows = await db
      .insert(schema.claimSources)
      .values({
        code: source.code,
        name: source.name,
        claimNumberPrefix: source.claimNumberPrefix,
        sortOrder: source.sortOrder,
        defaultCustomerId: customer?.id ?? null,
      })
      .onConflictDoNothing({ target: schema.claimSources.code })
      .returning({ code: schema.claimSources.code })

    if (insertedRows.length > 0) {
      inserted++
    }
  }

  console.log(`[seed:claim_sources] Inserted ${inserted} / ${CLAIM_SOURCES.length} claim sources`)
}
