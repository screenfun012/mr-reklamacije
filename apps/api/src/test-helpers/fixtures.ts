import { schema } from '@mr/db'
import { eq } from 'drizzle-orm'

import type { ApiDatabase } from '../core/database.js'

export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'

export async function ensureTestUser(db: ApiDatabase, id = TEST_USER_ID): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      id,
      email: `test-user-${id}@mrengines.rs`,
      name: 'Test Operator',
    })
    .onConflictDoNothing()
}

export async function getEmployeeIdByNormalizedName(
  db: ApiDatabase,
  normalizedName: string,
): Promise<string> {
  const [employee] = await db
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .where(eq(schema.employees.normalizedName, normalizedName))
    .limit(1)

  if (employee === undefined) {
    throw new Error(`Employee ${normalizedName} not found — run db:seed`)
  }

  return employee.id
}

export async function getClaimSourceIdByCode(db: ApiDatabase, code: string): Promise<string> {
  const [source] = await db
    .select({ id: schema.claimSources.id })
    .from(schema.claimSources)
    .where(eq(schema.claimSources.code, code))
    .limit(1)

  if (source === undefined) {
    throw new Error(`Claim source ${code} not found — run db:seed`)
  }

  return source.id
}

export async function getCustomerIdByName(db: ApiDatabase, name: string): Promise<string> {
  const [customer] = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(eq(schema.customers.name, name))
    .limit(1)

  if (customer === undefined) {
    throw new Error(`Customer ${name} not found — run db:seed`)
  }

  return customer.id
}

export async function getDepartmentIdByCode(db: ApiDatabase, code: string): Promise<string> {
  const [department] = await db
    .select({ id: schema.departments.id })
    .from(schema.departments)
    .where(eq(schema.departments.code, code))
    .limit(1)

  if (department === undefined) {
    throw new Error(`Department ${code} not found — run db:seed`)
  }

  return department.id
}
