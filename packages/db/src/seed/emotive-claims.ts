import { ClaimOutcome } from '@mr/shared'
import { and, eq, isNull, notInArray, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'
import { CANONICAL_ENGINE_TYPE_CODES } from './engine-types.js'

const ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'screenfun99@gmail.com'

interface EmotiveClaimSeedRow {
  mrNumber: string
  claimNumber: string | null
  customerName: string
  sourceCode: string
  engineCode: string
  employeeName: string
  dateOfClaim: string
  dateOfFinish: string | null
  outcome: (typeof ClaimOutcome)[keyof typeof ClaimOutcome]
  warrantyReport: string
}

const EMOTIVE_CLAIMS: EmotiveClaimSeedRow[] = [
  {
    mrNumber: '7910/25',
    claimNumber: 'KUC-25-04311',
    customerName: 'HILLS',
    sourceCode: 'HMT',
    engineCode: 'BMW N47D20D',
    employeeName: 'Petar Nikolić',
    dateOfClaim: '2026-06-04',
    dateOfFinish: '2025-12-15',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Curenje ulja na hladnom startu',
  },
  {
    mrNumber: '7865/25',
    claimNumber: 'RGC-26-34584',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'BMW N47D20D',
    employeeName: 'Dejan Milovanović',
    dateOfClaim: '2026-05-28',
    dateOfFinish: '2025-11-20',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Povećan pritisak ulja nakon remonta',
  },
  {
    mrNumber: '7448/25',
    claimNumber: 'SEL0182',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'Range rover 448DT',
    employeeName: 'Ivica Stanisavljević',
    dateOfClaim: '2026-05-15',
    dateOfFinish: '2025-10-03',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Neujednačen rad motora na leru',
  },
  {
    mrNumber: '7440/25',
    claimNumber: null,
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'Ford YMF',
    employeeName: 'Marko Petrović',
    dateOfClaim: '2026-05-10',
    dateOfFinish: '2025-09-18',
    outcome: ClaimOutcome.Rejected,
    warrantyReport: 'Kratkotrajno paljenje lampice motora',
  },
  {
    mrNumber: '7321/25',
    claimNumber: 'VB0587',
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'Opel A20DTH',
    employeeName: 'Milan Stojanović',
    dateOfClaim: '2026-04-22',
    dateOfFinish: '2025-08-12',
    outcome: ClaimOutcome.Archived,
    warrantyReport: 'Zamena turbine zbog habanja',
  },
  {
    mrNumber: '7288/25',
    claimNumber: 'RGC-25-29811',
    customerName: 'MR ENGINES',
    sourceCode: 'APPROVED_GREEN',
    engineCode: 'Mercedes OM651',
    employeeName: 'Dragan Pavlović',
    dateOfClaim: '2026-04-08',
    dateOfFinish: '2025-07-01',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Pucanje cevovoda intercoolera',
  },
  {
    mrNumber: '7195/25',
    claimNumber: 'SEL0175',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'BMW N47D20D',
    employeeName: 'Saša Radosavljević',
    dateOfClaim: '2026-03-30',
    dateOfFinish: '2025-06-14',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Metal u ulju nakon prvog starta',
  },
  {
    mrNumber: '7150/25',
    claimNumber: null,
    customerName: 'NEWPARTS',
    sourceCode: 'JONKER',
    engineCode: 'Ford YMF',
    employeeName: 'Nebojša Lazić',
    dateOfClaim: '2026-03-18',
    dateOfFinish: '2025-05-22',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Gubitak snage iznad 3000 obrtaja',
  },
  {
    mrNumber: '7088/25',
    claimNumber: 'KUC-25-03102',
    customerName: 'HILLS',
    sourceCode: 'HMT',
    engineCode: 'BMW N47D20D',
    employeeName: 'Tomislav Janković',
    dateOfClaim: '2026-03-05',
    dateOfFinish: '2025-04-30',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Neispravan rad EGR ventila',
  },
  {
    mrNumber: '7022/25',
    claimNumber: 'RGC-26-30144',
    customerName: 'TRENT',
    sourceCode: 'APPROVED_GREEN',
    engineCode: 'Opel A20DTH',
    employeeName: 'Branko Filipović',
    dateOfClaim: '2026-02-20',
    dateOfFinish: '2025-03-11',
    outcome: ClaimOutcome.Rejected,
    warrantyReport: 'Pucanje zaptivača glave',
  },
  {
    mrNumber: '6981/25',
    claimNumber: 'SEL0168',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'Range rover 448DT',
    employeeName: 'Dejan Milovanović',
    dateOfClaim: '2026-02-08',
    dateOfFinish: '2025-02-01',
    outcome: ClaimOutcome.Archived,
    warrantyReport: 'Neujednačena kompresija cilindra 3',
  },
  {
    mrNumber: '6910/25',
    claimNumber: null,
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'Mercedes OM651',
    employeeName: 'Goran Mitrović',
    dateOfClaim: '2026-01-25',
    dateOfFinish: '2024-12-18',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Buka iz područja remenice',
  },
  {
    mrNumber: '6844/25',
    claimNumber: 'VB0571',
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'BMW N47D20D',
    employeeName: 'Zoran Popović',
    dateOfClaim: '2026-01-12',
    dateOfFinish: '2024-11-05',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Pregrevanje nakon montaže',
  },
  {
    mrNumber: '6775/25',
    claimNumber: 'RGC-25-28790',
    customerName: 'MRT POLSKA',
    sourceCode: 'APPROVED_GREEN',
    engineCode: 'Ford YMF',
    employeeName: 'Miroslav Vujičić',
    dateOfClaim: '2025-12-28',
    dateOfFinish: '2024-10-20',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Curenje rashladne tečnosti',
  },
  {
    mrNumber: '6702/25',
    claimNumber: 'SEL0159',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'Opel A20DTH',
    employeeName: 'Ivan Kovačević',
    dateOfClaim: '2025-12-15',
    dateOfFinish: '2024-09-14',
    outcome: ClaimOutcome.Rejected,
    warrantyReport: 'Dim iz auspuha pri ubrzanju',
  },
  {
    mrNumber: '6638/25',
    claimNumber: null,
    customerName: 'JONKER',
    sourceCode: 'JONKER',
    engineCode: 'Range rover 448DT',
    employeeName: 'Dušan Đukić',
    dateOfClaim: '2025-12-01',
    dateOfFinish: '2024-08-22',
    outcome: ClaimOutcome.Archived,
    warrantyReport: 'Neispravan rad senzora pritiska ulja',
  },
  {
    mrNumber: '6580/25',
    claimNumber: 'KUC-25-02844',
    customerName: 'HILLS',
    sourceCode: 'HMT',
    engineCode: 'BMW N47D20D',
    employeeName: 'Aleksandar Đorđević',
    dateOfClaim: '2025-11-18',
    dateOfFinish: '2024-07-30',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Vibracije na leru posle montaže',
  },
  {
    mrNumber: '6511/25',
    claimNumber: 'RGC-25-28102',
    customerName: 'VEGE TUNISIE',
    sourceCode: 'APPROVED_GREEN',
    engineCode: 'Mercedes OM651',
    employeeName: 'Slobodan Ilić',
    dateOfClaim: '2025-11-05',
    dateOfFinish: '2024-06-18',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Kratko paljenje DPF lampice',
  },
  {
    mrNumber: '6440/25',
    claimNumber: 'SEL0151',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'BMW N47D20D',
    employeeName: 'Vladimir Marković',
    dateOfClaim: '2025-10-22',
    dateOfFinish: '2024-05-09',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Gubitak antifriza bez vidljivog curenja',
  },
  {
    mrNumber: '6375/25',
    claimNumber: null,
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'Ford YMF',
    employeeName: 'Filip Kostović',
    dateOfClaim: '2025-10-08',
    dateOfFinish: '2024-04-15',
    outcome: ClaimOutcome.Rejected,
    warrantyReport: 'Neispravan rad turbine',
  },
  {
    mrNumber: '6302/25',
    claimNumber: 'VB0560',
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'Opel A20DTH',
    employeeName: 'Srđan Obradović',
    dateOfClaim: '2025-09-25',
    dateOfFinish: '2024-03-28',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Pucanje cevi za dovod ulja',
  },
  {
    mrNumber: '6240/25',
    claimNumber: 'RGC-25-27510',
    customerName: 'MRT VEGHEL',
    sourceCode: 'APPROVED_GREEN',
    engineCode: 'Range rover 448DT',
    employeeName: 'Petar Nikolić',
    dateOfClaim: '2025-09-10',
    dateOfFinish: '2024-02-20',
    outcome: ClaimOutcome.Archived,
    warrantyReport: 'Neispravan rad visokopritisne pumpe',
  },
  {
    mrNumber: '6188/25',
    claimNumber: 'SEL0144',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'BMW N47D20D',
    employeeName: 'Dejan Milovanović',
    dateOfClaim: '2025-08-28',
    dateOfFinish: '2024-01-12',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Povećana potrošnja ulja',
  },
  {
    mrNumber: '6120/25',
    claimNumber: null,
    customerName: 'OVERIGE',
    sourceCode: 'JONKER',
    engineCode: 'Mercedes OM651',
    employeeName: 'Bojan Stefanović',
    dateOfClaim: '2025-08-14',
    dateOfFinish: '2023-12-05',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Neispravan rad alternatora posle montaže',
  },
  {
    mrNumber: '6055/25',
    claimNumber: 'KUC-25-02411',
    customerName: 'HILLS',
    sourceCode: 'HMT',
    engineCode: 'BMW N47D20D',
    employeeName: 'Nenad Todorović',
    dateOfClaim: '2025-07-30',
    dateOfFinish: '2023-11-18',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Pucanje nosača motora',
  },
  {
    mrNumber: '5990/25',
    claimNumber: 'RGC-25-26844',
    customerName: 'NEWPARTS',
    sourceCode: 'APPROVED_GREEN',
    engineCode: 'Ford YMF',
    employeeName: 'Aleksandar Simić',
    dateOfClaim: '2025-07-15',
    dateOfFinish: '2023-10-02',
    outcome: ClaimOutcome.Rejected,
    warrantyReport: 'Neujednačen rad na hladnom startu',
  },
  {
    mrNumber: '5922/25',
    claimNumber: 'SEL0138',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'Opel A20DTH',
    employeeName: 'Marko Petrović',
    dateOfClaim: '2025-07-01',
    dateOfFinish: '2023-09-11',
    outcome: ClaimOutcome.Archived,
    warrantyReport: 'Kvar na senzoru temperature ulja',
  },
  {
    mrNumber: '5860/25',
    claimNumber: null,
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'Range rover 448DT',
    employeeName: 'Ivica Stanisavljević',
    dateOfClaim: '2025-06-18',
    dateOfFinish: '2023-08-20',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Pucanje cevi za vakuum',
  },
  {
    mrNumber: '5795/25',
    claimNumber: 'VB0548',
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'BMW N47D20D',
    employeeName: 'Milan Stojanović',
    dateOfClaim: '2025-06-05',
    dateOfFinish: '2023-07-14',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Neispravan rad ventila za punjenje',
  },
  {
    mrNumber: '5730/25',
    claimNumber: 'RGC-25-26190',
    customerName: 'TRENT',
    sourceCode: 'APPROVED_GREEN',
    engineCode: 'Mercedes OM651',
    employeeName: 'Dragan Pavlović',
    dateOfClaim: '2025-05-22',
    dateOfFinish: '2023-06-01',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Metalne čestice u filteru ulja',
  },
  {
    mrNumber: '5668/25',
    claimNumber: 'SEL0131',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'Ford YMF',
    employeeName: 'Saša Radosavljević',
    dateOfClaim: '2025-05-08',
    dateOfFinish: '2023-05-10',
    outcome: ClaimOutcome.Rejected,
    warrantyReport: 'Pucanje usisne grane',
  },
  {
    mrNumber: '5605/25',
    claimNumber: null,
    customerName: 'HMT',
    sourceCode: 'HMT',
    engineCode: 'Opel A20DTH',
    employeeName: 'Tomislav Janković',
    dateOfClaim: '2025-04-25',
    dateOfFinish: '2023-04-02',
    outcome: ClaimOutcome.Archived,
    warrantyReport: 'Neispravan rad motora na visokim obrtajima',
  },
  {
    mrNumber: '5540/25',
    claimNumber: 'KUC-25-01988',
    customerName: 'HILLS',
    sourceCode: 'HMT',
    engineCode: 'BMW N47D20D',
    employeeName: 'Branko Filipović',
    dateOfClaim: '2025-04-10',
    dateOfFinish: '2023-03-05',
    outcome: ClaimOutcome.Accepted,
    warrantyReport: 'Curenje ulja iz zadnje brtve',
  },
  {
    mrNumber: '5488/25',
    claimNumber: 'RGC-25-25501',
    customerName: 'MR ENGINES',
    sourceCode: 'APPROVED_GREEN',
    engineCode: 'Range rover 448DT',
    employeeName: 'Goran Mitrović',
    dateOfClaim: '2025-03-28',
    dateOfFinish: '2023-02-14',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Neispravan rad senzora obrtaja',
  },
  {
    mrNumber: '5420/25',
    claimNumber: 'SEL0124',
    customerName: 'SELMAN',
    sourceCode: 'SELMAN',
    engineCode: 'BMW N47D20D',
    employeeName: 'Zoran Popović',
    dateOfClaim: '2025-03-15',
    dateOfFinish: '2023-01-20',
    outcome: ClaimOutcome.Pending,
    warrantyReport: 'Pucanje cevi za rashladnu tečnost',
  },
  {
    mrNumber: '5365/25',
    claimNumber: null,
    customerName: 'VITOBELLO',
    sourceCode: 'VITOBELLO',
    engineCode: 'Mercedes OM651',
    employeeName: 'Miroslav Vujičić',
    dateOfClaim: '2025-03-01',
    dateOfFinish: '2022-12-18',
    outcome: ClaimOutcome.Rejected,
    warrantyReport: 'Neispravan rad klipnjaškog mehanizma',
  },
]

async function lookupIdByName(
  db: NodePgDatabase<typeof schema>,
  table: 'customers' | 'employees' | 'engineTypes' | 'claimSources',
  value: string,
): Promise<string | null> {
  if (table === 'customers') {
    const [row] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(and(eq(schema.customers.name, value), isNull(schema.customers.deletedAt)))
      .limit(1)
    return row?.id ?? null
  }

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
    .select({ id: schema.claimSources.id })
    .from(schema.claimSources)
    .where(and(eq(schema.claimSources.code, value), isNull(schema.claimSources.deletedAt)))
    .limit(1)
  return row?.id ?? null
}

async function resetEmotiveClaimsSeedData(db: NodePgDatabase<typeof schema>): Promise<void> {
  await db.delete(schema.emotiveClaimFaults)
  const deletedClaims = await db
    .delete(schema.emotiveClaims)
    .returning({ id: schema.emotiveClaims.id })
  const deletedEngineTypes = await db
    .delete(schema.engineTypes)
    .where(notInArray(schema.engineTypes.code, [...CANONICAL_ENGINE_TYPE_CODES]))
    .returning({ id: schema.engineTypes.id })

  await db.update(schema.engineTypes).set({ usageCount: 0 })

  console.log(
    `[seed:emotive-claims] Reset — removed ${deletedClaims.length} claims, ${deletedEngineTypes.length} non-canonical engine types`,
  )
}

export async function seedEmotiveClaims(db: NodePgDatabase<typeof schema>): Promise<void> {
  await resetEmotiveClaimsSeedData(db)

  const [admin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, ADMIN_EMAIL))
    .limit(1)

  if (admin === undefined) {
    console.warn(
      `[seed:emotive-claims] Skipped — admin user ${ADMIN_EMAIL} not found. Run pnpm create-admin first.`,
    )
    return
  }

  let inserted = 0

  for (const row of EMOTIVE_CLAIMS) {
    const existing = await db
      .select({ id: schema.emotiveClaims.id })
      .from(schema.emotiveClaims)
      .where(
        and(
          eq(schema.emotiveClaims.mrNumber, row.mrNumber),
          isNull(schema.emotiveClaims.deletedAt),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      continue
    }

    const customerId = await lookupIdByName(db, 'customers', row.customerName)
    const engineTypeId = await lookupIdByName(db, 'engineTypes', row.engineCode)
    const employeeId = await lookupIdByName(db, 'employees', row.employeeName)
    const sourceId = await lookupIdByName(db, 'claimSources', row.sourceCode)

    if (customerId === null || engineTypeId === null || employeeId === null || sourceId === null) {
      console.warn(`[seed:emotive-claims] Skipped ${row.mrNumber} — missing FK reference`)
      continue
    }

    const dateOfClaim = new Date(`${row.dateOfClaim}T00:00:00.000Z`)
    const dateOfFinish =
      row.dateOfFinish === null ? null : new Date(`${row.dateOfFinish}T00:00:00.000Z`)

    await db.insert(schema.emotiveClaims).values({
      mrNumber: row.mrNumber,
      claimNumber: row.claimNumber,
      warrantyReport: row.warrantyReport,
      engineTypeId,
      dateOfClaim,
      dateOfFinish,
      employeeId,
      sourceId,
      outcome: row.outcome,
      claimYear: dateOfClaim.getUTCFullYear(),
      customerId,
      createdBy: admin.id,
    })

    await db
      .update(schema.engineTypes)
      .set({ usageCount: sql`${schema.engineTypes.usageCount} + 1` })
      .where(eq(schema.engineTypes.id, engineTypeId))

    inserted++
  }

  console.log(
    `[seed:emotive-claims] Inserted ${inserted} / ${EMOTIVE_CLAIMS.length} emotive claims`,
  )
}
