import {
  PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  UserAccountStatus,
} from '@mr/shared'
import { eq, inArray, or } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import * as schema from '../../schema/index.js'
import {
  backfillApprovedUserRoles,
  findApprovedUsersWithoutRoles,
} from '../../seed/backfill-approved-user-roles.js'
import { seedRoles } from '../../seed/roles.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

const PROTECTED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NO_ROLES_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const WITH_ROLES_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PENDING_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const TEST_USER_IDS = [PROTECTED_ID, NO_ROLES_ID, WITH_ROLES_ID, PENDING_ID] as const

describe('backfillApprovedUserRoles (integration)', () => {
  let pool: ReturnType<typeof createPool>
  let db: NodePgDatabase<typeof schema>

  beforeEach(async () => {
    pool = createPool(getIntegrationDatabaseUrl())
    db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

    await seedRoles(db)

    await db.insert(schema.users).values([
      {
        id: PROTECTED_ID,
        email: PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
        name: 'Protected Admin',
        accountStatus: UserAccountStatus.Approved,
      },
      {
        id: NO_ROLES_ID,
        email: 'no-roles-backfill@mrengines.rs',
        name: 'No Roles User',
        accountStatus: UserAccountStatus.Approved,
      },
      {
        id: WITH_ROLES_ID,
        email: 'with-roles-backfill@mrengines.rs',
        name: 'With Roles User',
        accountStatus: UserAccountStatus.Approved,
      },
      {
        id: PENDING_ID,
        email: 'pending-backfill@mrengines.rs',
        name: 'Pending User',
        accountStatus: UserAccountStatus.Pending,
      },
    ])

    const [adminRole] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, SYSTEM_ROLE_ADMIN))
      .limit(1)

    const [operatorRole] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, SYSTEM_ROLE_OPERATOR))
      .limit(1)

    if (adminRole === undefined || operatorRole === undefined) {
      throw new Error('System roles missing — integration global setup should seed roles')
    }

    await db.insert(schema.userRoles).values([
      {
        userId: PROTECTED_ID,
        roleId: adminRole.id,
        assignedBy: PROTECTED_ID,
      },
      {
        userId: WITH_ROLES_ID,
        roleId: operatorRole.id,
        assignedBy: PROTECTED_ID,
      },
    ])
  })

  afterEach(async () => {
    await db
      .delete(schema.userRoles)
      .where(
        or(
          inArray(schema.userRoles.userId, [...TEST_USER_IDS]),
          inArray(schema.userRoles.assignedBy, [...TEST_USER_IDS]),
        ),
      )
    await db.delete(schema.users).where(inArray(schema.users.id, [...TEST_USER_IDS]))
    await pool.end()
  })

  it('finds approved users without roles excluding protected super-admin', async () => {
    const matches = await findApprovedUsersWithoutRoles(db, PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT)
    const matchIds = new Set(matches.map((user) => user.id))

    expect(matchIds.has(NO_ROLES_ID)).toBe(true)
    expect(matchIds.has(PROTECTED_ID)).toBe(false)
    expect(matchIds.has(WITH_ROLES_ID)).toBe(false)
    expect(matchIds.has(PENDING_ID)).toBe(false)
  })

  it('dry run lists candidates without inserting user_roles for the test user', async () => {
    const result = await backfillApprovedUserRoles(db, {
      protectedSuperAdminEmail: PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
      assignedByUserId: PROTECTED_ID,
      dryRun: true,
    })

    expect(result.dryRun).toBe(true)
    expect(result.affectedUsers.some((user) => user.id === NO_ROLES_ID)).toBe(true)

    const roleRows = await db
      .select()
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, NO_ROLES_ID))

    expect(roleRows).toHaveLength(0)
  })

  it('assigns operator role to approved users without roles', async () => {
    const result = await backfillApprovedUserRoles(db, {
      protectedSuperAdminEmail: PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
      assignedByUserId: PROTECTED_ID,
      dryRun: false,
    })

    expect(result.affectedUsers.some((user) => user.id === NO_ROLES_ID)).toBe(true)

    const roleRows = await db
      .select({ code: schema.roles.code })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(eq(schema.userRoles.userId, NO_ROLES_ID))

    expect(roleRows.map((row) => row.code)).toEqual([SYSTEM_ROLE_OPERATOR])
  })
})
