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

export async function getDepartmentIdByCode(
  db: ApiDatabase,
  code: string,
): Promise<string> {
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
