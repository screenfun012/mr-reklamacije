/**
 * One-off legacy migration: imports the old Turso/Prisma warranty app's data
 * into this database from `.legacy-import/legacy-data.json` (produced from the
 * `mr-engines-warranty` SQLite dump; the JSON and dump stay out of git).
 *
 * DRY RUN by default — prints the full mapping report without writing. Apply:
 *   pnpm --filter api import-legacy -- --apply
 *
 * Idempotent: claims are matched by mr_number per kind and skipped when they
 * already exist; catalogs are matched by name/code before creating. All writes
 * run in a single transaction. Audit log and SSE are intentionally bypassed —
 * this is a bulk bootstrap, not user activity. Runs against DATABASE_URL from
 * apps/api/.env — point it at the target environment deliberately.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { schema } from '@mr/db'
import {
  ClaimOutcome,
  CustomerKind,
  normalizeName,
  PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'

interface LegacyCustomer {
  id: string
  name: string | null
  company: string | null
  email: string | null
  country: string | null
  notes: string | null
}

interface LegacyClaim {
  id: string
  claimCodeRaw: string
  status: 'APPROVED' | 'REJECTED' | 'IN_ANALYSIS'
  customerNumber: string | null
  engineType: string
  mrEngineCode: string | null
  reason: string | null
  workerFault: string | null
  isDomesticMarket: 0 | 1
  dateEngineDone: string | null
  claimArrivalDate: string | null
  assignedWorkerName: string | null
  summarySr: string | null
  summaryEn: string | null
  createdAt: string
  updatedAt: string
  custName: string | null
  custCompany: string | null
  custEmail: string | null
  custCountry: string | null
}

interface LegacyData {
  companies: { name: string }[]
  workers: { name: string }[]
  departments: { name: string; isSystem: 0 | 1 }[]
  customers: LegacyCustomer[]
  claims: LegacyClaim[]
  faultDepartments: { claimId: string; departmentName: string }[]
  reportSections: {
    claimId: string
    orderIndex: number
    textSr: string | null
    textEn: string | null
  }[]
}

type Db = NodePgDatabase<typeof schema>

const OUTCOME_BY_STATUS: Record<LegacyClaim['status'], ClaimOutcome> = {
  APPROVED: ClaimOutcome.Accepted,
  REJECTED: ClaimOutcome.Rejected,
  IN_ANALYSIS: ClaimOutcome.Pending,
}

/** First word(s) of the legacy engine-type string → engine_manufacturers.code. */
const MANUFACTURER_PREFIXES: [string, string][] = [
  ['range rover', 'LAND_ROVER'],
  ['land rover', 'LAND_ROVER'],
  ['mercedes', 'MERCEDES_BENZ'],
  ['vw', 'VOLKSWAGEN'],
  ['volkswagen', 'VOLKSWAGEN'],
  ['bmw', 'BMW'],
  ['audi', 'AUDI'],
  ['ford', 'FORD'],
  ['opel', 'OPEL'],
  ['renault', 'RENAULT'],
  ['peugeot', 'PEUGEOT'],
  ['citroen', 'CITROEN'],
  ['citroën', 'CITROEN'],
  ['fiat', 'FIAT'],
  ['volvo', 'VOLVO'],
  ['toyota', 'TOYOTA'],
  ['honda', 'HONDA'],
  ['nissan', 'NISSAN'],
  ['hyundai', 'HYUNDAI'],
  ['kia', 'KIA'],
  ['iveco', 'IVECO'],
  ['man', 'MAN'],
  ['daf', 'DAF'],
  ['cummins', 'CUMMINS'],
]

const apply = process.argv.includes('--apply')
const report: string[] = []

function note(line: string): void {
  report.push(line)
  console.log(line)
}

function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function toDate(iso: string | null): Date | null {
  if (iso === null || iso === '') return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function manufacturerCodeFor(engineType: string): string | null {
  const lower = engineType.trim().toLowerCase()
  for (const [prefix, code] of MANUFACTURER_PREFIXES) {
    if (lower.startsWith(`${prefix} `) || lower === prefix) return code
  }
  return null
}

/** summarySr + report FINDINGS merged into one internal-notes text. */
function buildInternalNotes(
  claim: LegacyClaim,
  sections: LegacyData['reportSections'],
): string | null {
  const parts: string[] = []
  if (claim.summarySr !== null && claim.summarySr.trim() !== '') parts.push(claim.summarySr.trim())
  for (const s of sections) {
    const text = (s.textSr ?? s.textEn ?? '').trim()
    if (text !== '') parts.push(text)
  }
  if (parts.length === 0) return null
  return parts.join('\n\n')
}

async function loadLegacyData(): Promise<LegacyData> {
  const filePath = path.resolve(import.meta.dirname, '../../../.legacy-import/legacy-data.json')
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as LegacyData
}

async function resolveImportUser(db: Db): Promise<{ id: string; email: string }> {
  const email = process.env['PROTECTED_SUPER_ADMIN_EMAIL'] ?? PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT
  const [user] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
  if (user === undefined) {
    throw new Error(`Import user ${email} not found — create the admin first (pnpm create-admin)`)
  }
  return user
}

async function upsertDepartments(db: Db, data: LegacyData): Promise<Map<string, string>> {
  const existing = await db
    .select({ id: schema.departments.id, nameSr: schema.departments.nameSr })
    .from(schema.departments)
  const byNormalized = new Map(existing.map((d) => [normalizeName(d.nameSr), d.id]))
  const idByLegacyName = new Map<string, string>()

  for (const dept of data.departments) {
    const normalized = normalizeName(dept.name)
    const matched = byNormalized.get(normalized)
    if (matched !== undefined) {
      idByLegacyName.set(dept.name, matched)
      note(`  department "${dept.name}" → existing "${normalized}"`)
      continue
    }
    note(`  department "${dept.name}" → CREATE`)
    if (!apply) {
      idByLegacyName.set(dept.name, `dry-run-${normalized}`)
      continue
    }
    const [created] = await db
      .insert(schema.departments)
      .values({
        code: normalized.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
        nameSr: dept.name,
        nameEn: dept.name,
        sortOrder: 900,
      })
      .returning({ id: schema.departments.id })
    if (created !== undefined) idByLegacyName.set(dept.name, created.id)
  }
  return idByLegacyName
}

async function upsertEmployees(db: Db, data: LegacyData): Promise<Map<string, string>> {
  const existing = await db
    .select({ id: schema.employees.id, normalizedName: schema.employees.normalizedName })
    .from(schema.employees)
  const byNormalized = new Map(existing.map((e) => [e.normalizedName, e.id]))
  const idByNormalized = new Map<string, string>()

  for (const worker of data.workers) {
    const displayName = titleCaseName(worker.name)
    const normalized = normalizeName(displayName)
    const matched = byNormalized.get(normalized)
    if (matched !== undefined) {
      idByNormalized.set(normalized, matched)
      note(`  employee "${worker.name}" → existing`)
      continue
    }
    note(`  employee "${worker.name}" → CREATE as "${displayName}"`)
    if (!apply) {
      idByNormalized.set(normalized, `dry-run-${normalized}`)
      continue
    }
    const [created] = await db
      .insert(schema.employees)
      .values({ fullName: displayName, normalizedName: normalized })
      .returning({ id: schema.employees.id })
    if (created !== undefined) idByNormalized.set(normalized, created.id)
  }
  return idByNormalized
}

async function upsertCustomers(db: Db, firmNames: string[]): Promise<Map<string, string>> {
  const existing = await db
    .select({ id: schema.customers.id, name: schema.customers.name })
    .from(schema.customers)
  const byNormalized = new Map(existing.map((c) => [normalizeName(c.name), c.id]))
  const idByNormalized = new Map<string, string>()

  for (const name of firmNames) {
    const normalized = normalizeName(name)
    const matched = byNormalized.get(normalized)
    if (matched !== undefined) {
      idByNormalized.set(normalized, matched)
      note(`  customer firm "${name}" → existing`)
      continue
    }
    note(`  customer firm "${name}" → CREATE`)
    if (!apply) {
      idByNormalized.set(normalized, `dry-run-${normalized}`)
      continue
    }
    const [created] = await db
      .insert(schema.customers)
      .values({ kind: CustomerKind.EmotivePartner, name })
      .returning({ id: schema.customers.id })
    if (created !== undefined) idByNormalized.set(normalized, created.id)
  }
  return idByNormalized
}

async function upsertEngineTypes(
  db: Db,
  data: LegacyData,
): Promise<Map<string, { id: string; manufacturerId: string | null }>> {
  const manufacturers = await db
    .select({ id: schema.engineManufacturers.id, code: schema.engineManufacturers.code })
    .from(schema.engineManufacturers)
  const manufacturerByCode = new Map(manufacturers.map((m) => [m.code, m.id]))

  const existing = await db
    .select({
      id: schema.engineTypes.id,
      code: schema.engineTypes.code,
      manufacturerId: schema.engineTypes.manufacturerId,
    })
    .from(schema.engineTypes)
  const byCode = new Map(existing.map((t) => [t.code.toLowerCase(), t]))

  // Case-insensitive grouping: "AUDI CDN" and "Audi CDN" are one type. The
  // most frequently used spelling wins as the catalog code.
  const variantsByLower = new Map<string, Map<string, number>>()
  for (const claim of data.claims) {
    const code = claim.engineType.trim()
    const variants = variantsByLower.get(code.toLowerCase()) ?? new Map<string, number>()
    variants.set(code, (variants.get(code) ?? 0) + 1)
    variantsByLower.set(code.toLowerCase(), variants)
  }

  const result = new Map<string, { id: string; manufacturerId: string | null }>()
  for (const [lower, variants] of [...variantsByLower.entries()].sort()) {
    const usage = [...variants.values()].reduce((a, b) => a + b, 0)
    const [code] = [...variants.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['']
    const registerAllVariants = (entry: { id: string; manufacturerId: string | null }): void => {
      for (const variant of variants.keys()) result.set(variant, entry)
    }
    if (variants.size > 1) {
      note(
        `  engine type variants ${[...variants.keys()].map((v) => `"${v}"`).join(' + ')} → unified as "${code}"`,
      )
    }
    const matched = byCode.get(lower)
    if (matched !== undefined) {
      registerAllVariants({ id: matched.id, manufacturerId: matched.manufacturerId })
      note(`  engine type "${code}" → existing (${usage} claims)`)
      continue
    }
    const manufacturerCode = manufacturerCodeFor(code)
    const manufacturerId =
      manufacturerCode === null ? null : (manufacturerByCode.get(manufacturerCode) ?? null)
    note(
      `  engine type "${code}" → CREATE (manufacturer: ${manufacturerCode ?? 'NONE'}, ${usage} claims)`,
    )
    if (!apply) {
      registerAllVariants({ id: `dry-run-${code}`, manufacturerId })
      continue
    }
    const [created] = await db
      .insert(schema.engineTypes)
      .values({ code, manufacturerId, usageCount: usage })
      .returning({ id: schema.engineTypes.id })
    if (created !== undefined) registerAllVariants({ id: created.id, manufacturerId })
  }
  return result
}

interface ImportContext {
  importUserId: string
  departmentIdByLegacyName: Map<string, string>
  employeeIdByNormalized: Map<string, string>
  customerIdByNormalized: Map<string, string>
  engineTypeByCode: Map<string, { id: string; manufacturerId: string | null }>
  sectionsByClaimId: Map<string, LegacyData['reportSections']>
  faultDepartmentsByClaimId: Map<string, string[]>
}

function buildContextIndexes(
  data: LegacyData,
): Pick<ImportContext, 'sectionsByClaimId' | 'faultDepartmentsByClaimId'> {
  const sectionsByClaimId = new Map<string, LegacyData['reportSections']>()
  for (const s of data.reportSections) {
    const list = sectionsByClaimId.get(s.claimId) ?? []
    list.push(s)
    sectionsByClaimId.set(s.claimId, list)
  }
  const faultDepartmentsByClaimId = new Map<string, string[]>()
  for (const link of data.faultDepartments) {
    const list = faultDepartmentsByClaimId.get(link.claimId) ?? []
    list.push(link.departmentName)
    faultDepartmentsByClaimId.set(link.claimId, list)
  }
  return { sectionsByClaimId, faultDepartmentsByClaimId }
}

/** Same MR number entered twice in the old app → keep the latest entry. */
function dedupeClaims(claims: LegacyClaim[], warnings: string[]): LegacyClaim[] {
  const byKey = new Map<string, LegacyClaim>()
  for (const claim of claims) {
    const key = `${claim.isDomesticMarket}:${claim.claimCodeRaw.trim()}`
    const kept = byKey.get(key)
    if (kept === undefined || claim.updatedAt > kept.updatedAt) byKey.set(key, claim)
    if (kept !== undefined) {
      warnings.push(
        `${claim.claimCodeRaw}: entered twice in the old app — kept the newer entry, dropped the older`,
      )
    }
  }
  return [...byKey.values()]
}

async function importClaims(db: Db, data: LegacyData, ctx: ImportContext): Promise<void> {
  const existingEmotive = await db
    .select({ mrNumber: schema.emotiveClaims.mrNumber })
    .from(schema.emotiveClaims)
  const existingDomace = await db
    .select({ mrNumber: schema.domaceClaims.mrNumber })
    .from(schema.domaceClaims)
  const seenEmotive = new Set(existingEmotive.map((c) => c.mrNumber))
  const seenDomace = new Set(existingDomace.map((c) => c.mrNumber))

  let imported = 0
  let skipped = 0
  const warnings: string[] = []
  const claims = dedupeClaims(data.claims, warnings)

  for (const claim of claims) {
    const isDomace = claim.isDomesticMarket === 1
    const mrNumber = claim.claimCodeRaw.trim()
    if (isDomace ? seenDomace.has(mrNumber) : seenEmotive.has(mrNumber)) {
      skipped++
      note(`  SKIP ${mrNumber} — already exists`)
      continue
    }

    const dateOfClaim = toDate(claim.claimArrivalDate) ?? toDate(claim.createdAt)
    if (dateOfClaim === null) {
      warnings.push(`${mrNumber}: no usable date — claim NOT imported`)
      continue
    }
    const outcome = OUTCOME_BY_STATUS[claim.status]
    const engineType = ctx.engineTypeByCode.get(claim.engineType.trim())
    if (engineType === undefined) {
      warnings.push(`${mrNumber}: engine type "${claim.engineType}" missing after catalog pass`)
      continue
    }

    const assignedNormalized =
      claim.assignedWorkerName === null
        ? null
        : normalizeName(titleCaseName(claim.assignedWorkerName))
    const employeeId =
      assignedNormalized === null
        ? null
        : (ctx.employeeIdByNormalized.get(assignedNormalized) ?? null)
    if (claim.assignedWorkerName !== null && employeeId === null) {
      warnings.push(
        `${mrNumber}: assigned worker "${claim.assignedWorkerName}" not in worker list — left empty`,
      )
    }

    const shared = {
      claimNumber: claim.customerNumber?.trim() || null,
      warrantyReport: claim.reason?.trim() || null,
      engineTypeId: engineType.id,
      manufacturerId: engineType.manufacturerId,
      engineCode: claim.mrEngineCode?.trim() || null,
      dateOfClaim,
      mrNumber,
      dateOfFinish: toDate(claim.dateEngineDone),
      employeeId,
      outcome,
      outcomeResolvedAt: outcome === ClaimOutcome.Pending ? null : toDate(claim.updatedAt),
      claimYear: dateOfClaim.getUTCFullYear(),
      internalNotes: buildInternalNotes(claim, ctx.sectionsByClaimId.get(claim.id) ?? []),
      inspectionReport: claim.summaryEn?.trim() || null,
      createdBy: ctx.importUserId,
      createdAt: toDate(claim.createdAt) ?? dateOfClaim,
      updatedAt: toDate(claim.updatedAt) ?? dateOfClaim,
    }

    const firmName = isDomace ? null : claim.custCompany?.trim() || null
    if (!isDomace && firmName === null) {
      warnings.push(`${mrNumber}: EMOTIVE claim without firm — customer left empty`)
    }

    note(`  ${mrNumber} → ${isDomace ? 'DOMACE' : 'EMOTIVE'} (${outcome})`)
    if (!apply) {
      imported++
      checkFaultMappings(claim, ctx, warnings)
      continue
    }

    let newClaimId: string | undefined
    if (isDomace) {
      const customerName = claim.custCompany?.trim() || claim.custName?.trim() || null
      const [created] = await db
        .insert(schema.domaceClaims)
        .values({ ...shared, customerName })
        .returning({ id: schema.domaceClaims.id })
      newClaimId = created?.id
      seenDomace.add(mrNumber)
    } else {
      const customerId =
        firmName === null ? null : (ctx.customerIdByNormalized.get(normalizeName(firmName)) ?? null)
      const [created] = await db
        .insert(schema.emotiveClaims)
        .values({ ...shared, customerId })
        .returning({ id: schema.emotiveClaims.id })
      newClaimId = created?.id
      seenEmotive.add(mrNumber)
    }
    if (newClaimId === undefined) continue
    imported++

    await importClaimFaults(db, claim, newClaimId, isDomace, ctx, warnings)
  }

  note(`\nClaims: ${imported} imported, ${skipped} skipped as existing`)
  if (warnings.length > 0) {
    note(`\nWarnings (${warnings.length}):`)
    for (const w of warnings) note(`  ⚠ ${w}`)
  }
}

/** Dry-run counterpart of importClaimFaults — mapping checks only, no writes. */
function checkFaultMappings(claim: LegacyClaim, ctx: ImportContext, warnings: string[]): void {
  for (const name of ctx.faultDepartmentsByClaimId.get(claim.id) ?? []) {
    if (!ctx.departmentIdByLegacyName.has(name)) {
      warnings.push(`${claim.claimCodeRaw}: fault department "${name}" unmapped`)
    }
  }
  if (claim.workerFault !== null && claim.workerFault.trim() !== '') {
    const normalized = normalizeName(titleCaseName(claim.workerFault))
    if (!ctx.employeeIdByNormalized.has(normalized)) {
      warnings.push(`${claim.claimCodeRaw}: fault worker "${claim.workerFault}" unmapped`)
    }
  }
}

async function importClaimFaults(
  db: Db,
  claim: LegacyClaim,
  newClaimId: string,
  isDomace: boolean,
  ctx: ImportContext,
  warnings: string[],
): Promise<void> {
  const table = isDomace ? schema.domaceClaimFaults : schema.emotiveClaimFaults
  const departmentNames = ctx.faultDepartmentsByClaimId.get(claim.id) ?? []
  for (const name of departmentNames) {
    const departmentId = ctx.departmentIdByLegacyName.get(name)
    if (departmentId === undefined) {
      warnings.push(`${claim.claimCodeRaw}: fault department "${name}" unmapped`)
      continue
    }
    await db.insert(table).values({ claimId: newClaimId, faultType: 'department', departmentId })
  }
  if (claim.workerFault !== null && claim.workerFault.trim() !== '') {
    const normalized = normalizeName(titleCaseName(claim.workerFault))
    const employeeId = ctx.employeeIdByNormalized.get(normalized)
    if (employeeId === undefined) {
      warnings.push(`${claim.claimCodeRaw}: fault worker "${claim.workerFault}" unmapped`)
      return
    }
    await db.insert(table).values({ claimId: newClaimId, faultType: 'employee', employeeId })
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']
  if (databaseUrl === undefined) {
    console.error('DATABASE_URL is required (run with --env-file=.env)')
    process.exit(1)
  }

  const data = await loadLegacyData()
  note(
    `Legacy data: ${data.claims.length} claims, ${data.customers.length} customers, ${data.workers.length} workers`,
  )
  note(
    apply
      ? '\nAPPLY MODE — writing to the database.\n'
      : '\nDRY RUN — nothing will be written. Re-run with --apply to import.\n',
  )

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const db = drizzle(pool, { schema })

  try {
    await db.transaction(async (tx) => {
      const importUser = await resolveImportUser(tx)
      note(`Import user: ${importUser.email}`)

      // Firms referenced by EMOTIVE claims ∪ the old app's firm registry.
      const firmNames = new Map<string, string>()
      for (const c of data.companies) firmNames.set(normalizeName(c.name), c.name)
      for (const claim of data.claims) {
        const company = claim.custCompany?.trim()
        if (claim.isDomesticMarket === 0 && company !== undefined && company !== '') {
          if (!firmNames.has(normalizeName(company))) firmNames.set(normalizeName(company), company)
        }
      }

      note('\nDepartments:')
      const departmentIdByLegacyName = await upsertDepartments(tx, data)
      note('\nEmployees:')
      const employeeIdByNormalized = await upsertEmployees(tx, data)
      note('\nCustomer firms:')
      const customerIdByNormalized = await upsertCustomers(tx, [...firmNames.values()])
      note('\nEngine types:')
      const engineTypeByCode = await upsertEngineTypes(tx, data)

      note('\nClaims:')
      await importClaims(tx, data, {
        importUserId: importUser.id,
        departmentIdByLegacyName,
        employeeIdByNormalized,
        customerIdByNormalized,
        engineTypeByCode,
        ...buildContextIndexes(data),
      })
    })
  } finally {
    await pool.end()
  }

  note(
    apply
      ? '\nDone — data imported.'
      : '\nDry run complete — review above, then re-run with --apply.',
  )
}

await main()
