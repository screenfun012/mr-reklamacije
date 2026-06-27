import { resolveProtectedSuperAdminEmail } from '@mr/shared'
import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { createDb, createPool, getDatabaseUrl } from '../client.js'
import * as schema from '../schema/index.js'
import {
  backfillApprovedUserRoles,
  findApprovedUsersWithoutRoles,
} from './backfill-approved-user-roles.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../../..')
config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })

const PROTECTED_EMAIL = resolveProtectedSuperAdminEmail(process.env['PROTECTED_SUPER_ADMIN_EMAIL'])

function printWhereFilter(): void {
  console.log('[backfill:approved-user-roles] WHERE filter (exact logic):')
  console.log(`  account_status = 'approved'`)
  console.log(`  deleted_at IS NULL`)
  console.log(`  lower(trim(email)) <> '${PROTECTED_EMAIL.toLowerCase()}'`)
  console.log(`  NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = users.id)`)
  console.log(`  → assigns role '${'operator'}'`)
}

async function resolveAssignedByUserId(db: NodePgDatabase<typeof schema>): Promise<string> {
  const [protectedUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, PROTECTED_EMAIL))
    .limit(1)

  if (protectedUser !== undefined) {
    return protectedUser.id
  }

  throw new Error(
    `[backfill:approved-user-roles] Protected super-admin user (${PROTECTED_EMAIL}) not found — cannot set assigned_by`,
  )
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const pool = createPool(getDatabaseUrl())
  const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

  try {
    printWhereFilter()

    const candidates = await findApprovedUsersWithoutRoles(db, PROTECTED_EMAIL)

    console.log(`[backfill:approved-user-roles] Matched ${candidates.length} user(s):`)
    for (const user of candidates) {
      console.log(`  - ${user.email} (${user.name}) [${user.id}]`)
    }

    if (!execute) {
      console.log('[backfill:approved-user-roles] Dry run — pass --execute to apply operator role.')
      return
    }

    const assignedByUserId = await resolveAssignedByUserId(db)
    const result = await backfillApprovedUserRoles(db, {
      protectedSuperAdminEmail: PROTECTED_EMAIL,
      assignedByUserId,
      dryRun: false,
    })

    console.log(
      `[backfill:approved-user-roles] Applied operator role to ${result.affectedUsers.length} user(s).`,
    )
  } catch (error) {
    console.error('[backfill:approved-user-roles] Failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
