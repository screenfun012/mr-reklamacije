#!/usr/bin/env tsx
/**
 * Creates an admin user in the local development database.
 *
 * Uses Better-Auth's `auth.api.signUpEmail` for proper password
 * hashing and account/user row creation, then assigns the admin
 * role via direct `user_roles` insert with self-assignment
 * (bootstrap pattern for the first admin — every subsequent admin
 * is created through the UI by an existing admin).
 *
 * Idempotent: if the target user already exists, creation is
 * skipped and only the role assignment is attempted (also
 * idempotent via `onConflictDoNothing`).
 *
 * Usage:
 *   pnpm create-admin
 *
 * Environment overrides (all optional):
 *   ADMIN_EMAIL     (default: screenfun99@gmail.com)
 *   ADMIN_PASSWORD  (default: MrAdmin2026!Pass)
 *   ADMIN_NAME      (default: Nikola Admin)
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAuth } from '@mr/auth'
import { createDb, createPool, getDatabaseUrl, schema } from '@mr/db'
import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })
config({ path: resolve(repoRoot, 'apps/api/.env') })

const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? 'screenfun99@gmail.com'
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'MrAdmin2026!Pass'
const ADMIN_NAME = process.env['ADMIN_NAME'] ?? 'Nikola Admin'

async function main(): Promise<void> {
  const pool = createPool(getDatabaseUrl())
  const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>
  const auth = createAuth(db)

  try {
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, ADMIN_EMAIL))
      .limit(1)

    let userId: string
    const existingUser = existing[0]

    if (existingUser !== undefined) {
      console.log(`✓ User ${ADMIN_EMAIL} already exists, skipping creation`)
      userId = existingUser.id
    } else {
      console.log(`→ Creating user ${ADMIN_EMAIL} via Better-Auth...`)
      const result = await auth.api.signUpEmail({
        body: {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          name: ADMIN_NAME,
        },
        headers: new Headers(),
      })

      if (result?.user?.id === undefined) {
        throw new Error(`Failed to create user: ${JSON.stringify(result)}`)
      }

      userId = result.user.id
      console.log(`✓ User created with id ${userId}`)
    }

    const adminRole = await db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.code, 'admin'))
      .limit(1)

    const role = adminRole[0]
    if (role === undefined) {
      throw new Error('Admin role not found. Run `pnpm --filter @mr/db db:seed` first.')
    }

    await db
      .insert(schema.userRoles)
      .values({
        userId,
        roleId: role.id,
        assignedBy: userId,
      })
      .onConflictDoNothing()

    console.log(`✓ Admin role assigned to ${ADMIN_EMAIL}`)
    console.log('\n--- Admin user ready ---')
    console.log(`Email:    ${ADMIN_EMAIL}`)
    console.log(`User ID:  ${userId}`)
    console.log('Role:     admin')
    console.log('---')
  } finally {
    await pool.end()
  }
}

main().catch((err: unknown) => {
  console.error('✗ Failed:', err)
  process.exit(1)
})
