import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

interface DepartmentSeed {
  code: string
  nameSr: string
  nameEn: string
  sortOrder: number
}

const DEPARTMENTS: DepartmentSeed[] = [
  { code: 'BLOKOVI', nameSr: 'Blokovi', nameEn: 'Engine Blocks', sortOrder: 10 },
  { code: 'GLAVE', nameSr: 'Glave', nameEn: 'Cylinder Heads', sortOrder: 20 },
  { code: 'RADILICE', nameSr: 'Radilice', nameEn: 'Crankshafts', sortOrder: 30 },
  { code: 'KLIPNJACE', nameSr: 'Klipnjače', nameEn: 'Connecting Rods', sortOrder: 40 },
  { code: 'RASKLAPANJE', nameSr: 'Rasklapanje', nameEn: 'Disassembly', sortOrder: 50 },
  { code: 'PERIONICA', nameSr: 'Perionica', nameEn: 'Parts Washing', sortOrder: 60 },
  { code: 'SKLAPANJE', nameSr: 'Sklapanje', nameEn: 'Assembly', sortOrder: 70 },
  { code: 'KONTROLA', nameSr: 'Kontrola', nameEn: 'Quality Control', sortOrder: 80 },
  { code: 'ZAVRSNA_KONTROLA', nameSr: 'Završna kontrola', nameEn: 'Final QC', sortOrder: 90 },
  { code: 'MAGACIN', nameSr: 'Magacin', nameEn: 'Warehouse', sortOrder: 100 },
]

export async function seedDepartments(db: NodePgDatabase<typeof schema>): Promise<void> {
  const inserted = await db
    .insert(schema.departments)
    .values(DEPARTMENTS)
    .onConflictDoNothing({ target: schema.departments.code })
    .returning({ code: schema.departments.code })

  console.log(`[seed:departments] Inserted ${inserted.length} / ${DEPARTMENTS.length} departments`)
}
