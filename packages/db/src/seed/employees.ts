import { normalizeName } from '@mr/shared'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

interface EmployeeSeed {
  fullName: string
  departmentCode: string
}

const EMPLOYEES: EmployeeSeed[] = [
  { fullName: 'Dejan Milovanović', departmentCode: 'BLOKOVI' },
  { fullName: 'Nikola Jović', departmentCode: 'BLOKOVI' },
  { fullName: 'Petar Nikolić', departmentCode: 'BLOKOVI' },
  { fullName: 'Ivica Stanisavljević', departmentCode: 'GLAVE' },
  { fullName: 'Marko Petrović', departmentCode: 'GLAVE' },
  { fullName: 'Aleksandar Đorđević', departmentCode: 'GLAVE' },
  { fullName: 'Milan Stojanović', departmentCode: 'RADILICE' },
  { fullName: 'Dragan Pavlović', departmentCode: 'RADILICE' },
  { fullName: 'Slobodan Ilić', departmentCode: 'KLIPNJACE' },
  { fullName: 'Vladimir Marković', departmentCode: 'KLIPNJACE' },
  { fullName: 'Goran Mitrović', departmentCode: 'RASKLAPANJE' },
  { fullName: 'Zoran Popović', departmentCode: 'RASKLAPANJE' },
  { fullName: 'Bojan Stefanović', departmentCode: 'RASKLAPANJE' },
  { fullName: 'Nenad Todorović', departmentCode: 'PERIONICA' },
  { fullName: 'Dušan Đukić', departmentCode: 'PERIONICA' },
  { fullName: 'Miroslav Vujičić', departmentCode: 'SKLAPANJE' },
  { fullName: 'Saša Radosavljević', departmentCode: 'SKLAPANJE' },
  { fullName: 'Ivan Kovačević', departmentCode: 'SKLAPANJE' },
  { fullName: 'Nebojša Lazić', departmentCode: 'KONTROLA' },
  { fullName: 'Tomislav Janković', departmentCode: 'KONTROLA' },
  { fullName: 'Branko Filipović', departmentCode: 'ZAVRSNA_KONTROLA' },
  { fullName: 'Srđan Obradović', departmentCode: 'ZAVRSNA_KONTROLA' },
  { fullName: 'Aleksandar Simić', departmentCode: 'MAGACIN' },
  { fullName: 'Filip Kostović', departmentCode: 'MAGACIN' },
]

export async function seedEmployees(db: NodePgDatabase<typeof schema>): Promise<void> {
  let inserted = 0

  for (const employee of EMPLOYEES) {
    const [department] = await db
      .select({ id: schema.departments.id })
      .from(schema.departments)
      .where(eq(schema.departments.code, employee.departmentCode))
      .limit(1)

    if (!department) {
      throw new Error(
        `[seed:employees] Department ${employee.departmentCode} not found — run seedDepartments first`,
      )
    }

    const insertedRows = await db
      .insert(schema.employees)
      .values({
        fullName: employee.fullName,
        normalizedName: normalizeName(employee.fullName),
        departmentId: department.id,
        isActive: true,
      })
      .onConflictDoNothing({ target: schema.employees.normalizedName })
      .returning({ id: schema.employees.id })

    if (insertedRows.length > 0) {
      inserted++
    }
  }

  console.log(`[seed:employees] Inserted ${inserted} / ${EMPLOYEES.length} employees`)
}
