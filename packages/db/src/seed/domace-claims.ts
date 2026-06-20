import { ClaimOutcome, FaultType } from '@mr/shared'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

const ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'screenfun99@gmail.com'

interface DomaceFaultSeed {
  type: (typeof FaultType)[keyof typeof FaultType]
  /** Resolved by full name for employee faults / department code for department faults. */
  ref: string
  notes?: string
}

interface DomaceClaimSeedRow {
  mrNumber: string | null
  claimNumber: string | null
  customerName: string | null
  engineTypeCode: string | null
  engineCode: string | null
  employeeName: string | null
  dateOfClaim: string | null
  dateOfFinish: string | null
  outcome: (typeof ClaimOutcome)[keyof typeof ClaimOutcome]
  warrantyReport: string | null
  totalAmount: number | null
  faults: DomaceFaultSeed[]
}

const DOMACE_CLAIMS: DomaceClaimSeedRow[] = [
  {
    mrNumber: 'MR1204/26',
    claimNumber: 'DOM-26-0012',
    customerName: 'Auto Stanić',
    engineTypeCode: 'BMW N47D20D',
    engineCode: 'WW552310984',
    employeeName: 'Dejan Milovanović',
    dateOfClaim: '2026-05-30',
    dateOfFinish: null,
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Curenje ulja sa poklopca ventila nakon remonta',
    totalAmount: 84500,
    faults: [
      { type: FaultType.Employee, ref: 'Dejan Milovanović', notes: 'Nije dotegnut poklopac' },
    ],
  },
  {
    mrNumber: 'MR1187/26',
    claimNumber: null,
    customerName: 'Servis Petrović',
    engineTypeCode: 'Opel A20DTH',
    engineCode: null,
    employeeName: 'Milan Stojanović',
    dateOfClaim: '2026-05-12',
    dateOfFinish: '2026-05-26',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Pojačana vibracija radilice na leru',
    totalAmount: 132000,
    faults: [
      { type: FaultType.Department, ref: 'RADILICE', notes: 'Balansiranje van tolerancije' },
      { type: FaultType.Employee, ref: 'Milan Stojanović' },
    ],
  },
  {
    mrNumber: null,
    claimNumber: 'DOM-26-0009',
    customerName: 'Kompresor Plus',
    engineTypeCode: null,
    engineCode: null,
    employeeName: null,
    dateOfClaim: '2026-04-18',
    dateOfFinish: null,
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Reklamacija bez radnog naloga — kupac dostavlja motor naknadno',
    totalAmount: null,
    faults: [],
  },
]

async function lookupId(
  db: NodePgDatabase<typeof schema>,
  table: 'employees' | 'engineTypes' | 'departments',
  value: string,
): Promise<string | null> {
  if (table === 'employees') {
    const [row] = await db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .where(and(eq(schema.employees.fullName, value), isNull(schema.employees.deletedAt)))
      .limit(1)
    return row?.id ?? null
  }

  if (table === 'engineTypes') {
    const [row] = await db
      .select({ id: schema.engineTypes.id })
      .from(schema.engineTypes)
      .where(and(eq(schema.engineTypes.code, value), isNull(schema.engineTypes.deletedAt)))
      .limit(1)
    return row?.id ?? null
  }

  const [row] = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(and(eq(schema.departments.code, value), isNull(schema.departments.deletedAt)))
    .limit(1)
  return row?.id ?? null
}

async function resetDomaceClaimsSeedData(db: NodePgDatabase<typeof schema>): Promise<void> {
  await db.delete(schema.domaceClaimFaults)
  const deleted = await db.delete(schema.domaceClaims).returning({ id: schema.domaceClaims.id })
  console.log(`[seed:domace-claims] Reset — removed ${deleted.length} claims`)
}

export async function seedDomaceClaims(db: NodePgDatabase<typeof schema>): Promise<void> {
  await resetDomaceClaimsSeedData(db)

  const [admin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, ADMIN_EMAIL))
    .limit(1)

  if (admin === undefined) {
    console.warn(
      `[seed:domace-claims] Skipped — admin user ${ADMIN_EMAIL} not found. Run pnpm create-admin first.`,
    )
    return
  }

  let inserted = 0

  for (const row of DOMACE_CLAIMS) {
    const engineTypeId =
      row.engineTypeCode === null ? null : await lookupId(db, 'engineTypes', row.engineTypeCode)
    const employeeId =
      row.employeeName === null ? null : await lookupId(db, 'employees', row.employeeName)

    const dateOfClaim =
      row.dateOfClaim === null ? null : new Date(`${row.dateOfClaim}T00:00:00.000Z`)
    const dateOfFinish =
      row.dateOfFinish === null ? null : new Date(`${row.dateOfFinish}T00:00:00.000Z`)
    const claimYear = (dateOfClaim ?? new Date()).getUTCFullYear()

    const [created] = await db
      .insert(schema.domaceClaims)
      .values({
        mrNumber: row.mrNumber,
        claimNumber: row.claimNumber,
        customerName: row.customerName,
        warrantyReport: row.warrantyReport,
        engineTypeId,
        engineCode: row.engineCode,
        dateOfClaim,
        dateOfFinish,
        employeeId,
        outcome: row.outcome,
        claimYear,
        totalAmount: row.totalAmount,
        createdBy: admin.id,
        updatedBy: admin.id,
      })
      .returning({ id: schema.domaceClaims.id })

    const claimId = created?.id
    if (claimId === undefined) {
      continue
    }

    for (const fault of row.faults) {
      if (fault.type === FaultType.Employee) {
        const faultEmployeeId = await lookupId(db, 'employees', fault.ref)
        if (faultEmployeeId === null) {
          continue
        }
        await db.insert(schema.domaceClaimFaults).values({
          claimId,
          faultType: FaultType.Employee,
          employeeId: faultEmployeeId,
          notes: fault.notes ?? null,
        })
      } else if (fault.type === FaultType.Department) {
        const faultDepartmentId = await lookupId(db, 'departments', fault.ref)
        if (faultDepartmentId === null) {
          continue
        }
        await db.insert(schema.domaceClaimFaults).values({
          claimId,
          faultType: FaultType.Department,
          departmentId: faultDepartmentId,
          notes: fault.notes ?? null,
        })
      }
    }

    if (engineTypeId !== null) {
      await db
        .update(schema.engineTypes)
        .set({ usageCount: sql`${schema.engineTypes.usageCount} + 1` })
        .where(eq(schema.engineTypes.id, engineTypeId))
    }

    inserted++
  }

  console.log(`[seed:domace-claims] Inserted ${inserted} / ${DOMACE_CLAIMS.length} domace claims`)
}
