import { normalizeName } from '@mr/shared'
import { eq, isNull } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

export interface DepartmentSeed {
  code: string
  nameSr: string
  nameEn: string
  sortOrder: number
}

export interface RosterEmployee {
  /** Full name in the app's "Given Surname" storage order. */
  fullName: string
  /** Must match an existing or freshly-seeded `departments.code`. */
  departmentCode: string
}

export interface EmployeeRoster {
  /** Departments to create if their code is missing (existing codes are left untouched). */
  departments: DepartmentSeed[]
  employees: RosterEmployee[]
}

export interface LinkEmployeesResult {
  departmentsCreated: number
  employeesCreated: number
  employeesReassigned: number
  employeesUnchanged: number
  /** Roster departmentCodes with no active department — those employees are skipped, not mis-linked. */
  unmatchedDepartmentCodes: string[]
}

type Db = NodePgDatabase<typeof schema>

/**
 * Order-independent identity key. `normalizeName` preserves word order, but the
 * source roster stores names "Surname Given" while the app stores "Given
 * Surname" — sorting the normalized tokens lets an existing employee match
 * regardless of order, so we update them (and keep their claim history) instead
 * of inserting a duplicate under a different `normalized_name`.
 */
function tokenSetKey(name: string): string {
  return normalizeName(name).split(' ').filter(Boolean).sort().join(' ')
}

async function createMissingDepartments(db: Db, seeds: DepartmentSeed[]): Promise<number> {
  if (seeds.length === 0) {
    return 0
  }
  const inserted = await db
    .insert(schema.departments)
    .values(seeds)
    .onConflictDoNothing({ target: schema.departments.code })
    .returning({ code: schema.departments.code })
  return inserted.length
}

async function loadDepartmentIdsByCode(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: schema.departments.id, code: schema.departments.code })
    .from(schema.departments)
    .where(isNull(schema.departments.deletedAt))
  return new Map(rows.map((row) => [row.code, row.id]))
}

async function loadEmployeeIndex(
  db: Db,
): Promise<Map<string, { id: string; departmentId: string | null }>> {
  const rows = await db
    .select({
      id: schema.employees.id,
      fullName: schema.employees.fullName,
      departmentId: schema.employees.departmentId,
    })
    .from(schema.employees)
    .where(isNull(schema.employees.deletedAt))
  return new Map(
    rows.map((row) => [tokenSetKey(row.fullName), { id: row.id, departmentId: row.departmentId }]),
  )
}

/**
 * Seeds the roster's departments (idempotent by code), then assigns every roster
 * employee to their department: existing employees are matched order-independently
 * and reassigned (their identity and history are preserved), unknown names are
 * created. Idempotent — a second run reports everything as unchanged. The caller
 * owns the transaction (the runner rolls back on dry-run).
 */
export async function linkEmployeesToDepartments(
  db: Db,
  roster: EmployeeRoster,
): Promise<LinkEmployeesResult> {
  const departmentsCreated = await createMissingDepartments(db, roster.departments)
  const departmentIdByCode = await loadDepartmentIdsByCode(db)
  const employeeByKey = await loadEmployeeIndex(db)

  const unmatchedDepartmentCodes = new Set<string>()
  const toCreate: { fullName: string; normalizedName: string; departmentId: string }[] = []
  let employeesReassigned = 0
  let employeesUnchanged = 0

  for (const entry of roster.employees) {
    const departmentId = departmentIdByCode.get(entry.departmentCode)
    if (departmentId === undefined) {
      unmatchedDepartmentCodes.add(entry.departmentCode)
      continue
    }

    const key = tokenSetKey(entry.fullName)
    const existing = employeeByKey.get(key)
    if (existing === undefined) {
      toCreate.push({
        fullName: entry.fullName,
        normalizedName: normalizeName(entry.fullName),
        departmentId,
      })
      // Guard against a duplicate name within the roster itself reinserting.
      employeeByKey.set(key, { id: '', departmentId })
      continue
    }

    if (existing.departmentId === departmentId) {
      employeesUnchanged += 1
      continue
    }
    await db
      .update(schema.employees)
      .set({ departmentId })
      .where(eq(schema.employees.id, existing.id))
    employeesReassigned += 1
  }

  if (toCreate.length > 0) {
    await db.insert(schema.employees).values(toCreate)
  }

  return {
    departmentsCreated,
    employeesCreated: toCreate.length,
    employeesReassigned,
    employeesUnchanged,
    unmatchedDepartmentCodes: [...unmatchedDepartmentCodes],
  }
}
