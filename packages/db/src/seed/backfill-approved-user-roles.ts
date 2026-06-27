import {
  SYSTEM_ROLE_OPERATOR,
  UserAccountStatus,
  resolveProtectedSuperAdminEmail,
} from '@mr/shared'
import { and, eq, isNull, notExists, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'

export interface ApprovedUserWithoutRoles {
  id: string
  email: string
  name: string
}

/**
 * SQL-equivalent filter:
 *
 * ```sql
 * SELECT u.id, u.email, u.name
 * FROM users u
 * WHERE u.account_status = 'approved'
 *   AND u.deleted_at IS NULL
 *   AND lower(trim(u.email::text)) <> lower(trim(:protectedSuperAdminEmail))
 *   AND NOT EXISTS (
 *     SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
 *   );
 * ```
 */
export async function findApprovedUsersWithoutRoles(
  db: NodePgDatabase<typeof schema>,
  protectedSuperAdminEmail?: string | null,
): Promise<ApprovedUserWithoutRoles[]> {
  const protectedEmail = resolveProtectedSuperAdminEmail(protectedSuperAdminEmail)

  return db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.accountStatus, UserAccountStatus.Approved),
        isNull(schema.users.deletedAt),
        sql`lower(trim(${schema.users.email}::text)) <> ${protectedEmail.toLowerCase()}`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.userRoles)
            .where(eq(schema.userRoles.userId, schema.users.id)),
        ),
      ),
    )
    .orderBy(schema.users.createdAt)
}

export interface BackfillApprovedUserRolesOptions {
  protectedSuperAdminEmail?: string | null
  assignedByUserId: string
  dryRun: boolean
}

export interface BackfillApprovedUserRolesResult {
  dryRun: boolean
  affectedUsers: ApprovedUserWithoutRoles[]
}

export async function backfillApprovedUserRoles(
  db: NodePgDatabase<typeof schema>,
  options: BackfillApprovedUserRolesOptions,
): Promise<BackfillApprovedUserRolesResult> {
  const affectedUsers = await findApprovedUsersWithoutRoles(db, options.protectedSuperAdminEmail)

  if (options.dryRun || affectedUsers.length === 0) {
    return { dryRun: options.dryRun, affectedUsers }
  }

  const [operatorRole] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.code, SYSTEM_ROLE_OPERATOR))
    .limit(1)

  if (operatorRole === undefined) {
    throw new Error('[backfill:approved-user-roles] operator role not found — run system seeds')
  }

  await db.transaction(async (tx) => {
    for (const user of affectedUsers) {
      await tx.insert(schema.userRoles).values({
        userId: user.id,
        roleId: operatorRole.id,
        assignedBy: options.assignedByUserId,
      })
    }
  })

  return { dryRun: false, affectedUsers }
}
