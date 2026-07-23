import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeName } from '@mr/shared'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import { linkEmployeesToDepartments } from '../../maintenance/link-employees-to-departments.js'
import type { EmployeeRoster } from '../../maintenance/link-employees-to-departments.js'
import * as schema from '../../schema/index.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool: pg.Pool
let client: pg.PoolClient
let db: NodePgDatabase<typeof schema>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  await migrate(createDb(pool), {
    migrationsFolder: resolve(__dirname, '../../../migrations'),
  })
})

beforeEach(async () => {
  client = await pool.connect()
  await client.query('BEGIN')
  db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>
  await db.execute(sql`TRUNCATE TABLE employees, departments RESTART IDENTITY CASCADE`)
})

afterEach(async () => {
  await client.query('ROLLBACK')
  client.release()
})

afterAll(async () => {
  await pool.end()
})

const roster: EmployeeRoster = {
  departments: [
    { code: 'GLAVE', nameSr: 'Glave', nameEn: 'Cylinder Heads', sortOrder: 20 },
    { code: 'VOZAC', nameSr: 'Vozač', nameEn: 'Driver', sortOrder: 220 },
  ],
  employees: [
    // Matches the pre-existing employee below, but written Surname-first as in the source Excel.
    { fullName: 'Duljaj Elmedin', departmentCode: 'GLAVE' },
    { fullName: 'Zoran Arsić', departmentCode: 'VOZAC' },
  ],
}

describe('linkEmployeesToDepartments', () => {
  it('creates missing departments, reassigns an existing worker by reversed name, and creates new ones', async () => {
    // Pre-existing worker stored "Given Surname" with claim history we must not orphan.
    const existingId = randomUUID()
    await db.insert(schema.employees).values({
      id: existingId,
      fullName: 'Elmedin Duljaj',
      normalizedName: normalizeName('Elmedin Duljaj'),
    })

    const result = await linkEmployeesToDepartments(db, roster)

    expect(result).toEqual({
      departmentsCreated: 2,
      employeesCreated: 1,
      employeesReassigned: 1,
      employeesUnchanged: 0,
      unmatchedDepartmentCodes: [],
    })

    // Same row updated — not duplicated — so its id (and any faults) survive.
    const workers = await db.select().from(schema.employees)
    expect(workers).toHaveLength(2)
    const elmedin = workers.find((w) => w.id === existingId)
    const [glave] = await db
      .select()
      .from(schema.departments)
      .where(eq(schema.departments.code, 'GLAVE'))
    expect(elmedin?.departmentId).toBe(glave?.id)

    const arsic = workers.find((w) => w.normalizedName === normalizeName('Zoran Arsić'))
    expect(arsic).toBeDefined()
    expect(arsic?.departmentId).not.toBeNull()
  })

  it('is idempotent — a second run changes nothing', async () => {
    await linkEmployeesToDepartments(db, roster)
    const second = await linkEmployeesToDepartments(db, roster)

    expect(second.departmentsCreated).toBe(0)
    expect(second.employeesCreated).toBe(0)
    expect(second.employeesReassigned).toBe(0)
    expect(second.employeesUnchanged).toBe(2)
    expect(await db.select().from(schema.employees)).toHaveLength(2)
  })

  it('reports a departmentCode with no matching department and skips that worker', async () => {
    const result = await linkEmployeesToDepartments(db, {
      departments: [],
      employees: [{ fullName: 'Neko Nepoznat', departmentCode: 'NEPOSTOJECE' }],
    })

    expect(result.unmatchedDepartmentCodes).toEqual(['NEPOSTOJECE'])
    expect(result.employeesCreated).toBe(0)
    expect(await db.select().from(schema.employees)).toHaveLength(0)
  })
})
