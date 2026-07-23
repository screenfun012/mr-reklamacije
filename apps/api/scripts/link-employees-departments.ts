/**
 * One-off roster load: creates the missing departments and assigns every worker
 * in `employee-roster.json` (a committed snapshot of the "Lista zaposlenih"
 * Excel, names already reordered to the app's "Given Surname" storage order) to
 * their department.
 *
 * DRY RUN by default — runs the whole thing in a transaction and rolls back,
 * printing the exact counts. Apply:
 *   pnpm --filter api link-employees-departments -- --apply
 *
 * Idempotent: existing workers are matched order-independently and reassigned
 * (their id and fault history are preserved), unknown names are created, and a
 * second run reports everything as unchanged. Audit log and SSE are bypassed —
 * this is a bulk bootstrap, not user activity. Uses DATABASE_URL from
 * apps/api/.env in dev, otherwise the process environment (Railway one-off shell).
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Tolerate a missing .env — in production config comes from the process env.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
} catch {
  // no .env file — fine
}

import { linkEmployeesToDepartments, schema } from '@mr/db'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { z } from 'zod'

const rosterSchema = z.object({
  departments: z
    .array(
      z.object({
        code: z.string().min(1),
        nameSr: z.string().min(1),
        nameEn: z.string().min(1),
        sortOrder: z.number().int(),
      }),
    )
    .min(1),
  employees: z
    .array(z.object({ fullName: z.string().min(1), departmentCode: z.string().min(1) }))
    .min(1),
})

const apply = process.argv.includes('--apply')

class DryRunRollback extends Error {}

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']
  if (databaseUrl === undefined) {
    console.error('DATABASE_URL is required (apps/api/.env in dev, service env in production)')
    process.exit(1)
  }

  const raw = await readFile(
    fileURLToPath(new URL('./employee-roster.json', import.meta.url)),
    'utf8',
  )
  const roster = rosterSchema.parse(JSON.parse(raw))
  console.log(
    `Roster: ${roster.employees.length} workers, ${roster.departments.length} departments to ensure`,
  )
  console.log(
    apply
      ? '\nAPPLY MODE — writing to the database.\n'
      : '\nDRY RUN — nothing will be written. Re-run with --apply to load.\n',
  )

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const db = drizzle(pool, { schema })

  try {
    await db.transaction(async (tx) => {
      const result = await linkEmployeesToDepartments(tx, roster)
      console.log(`Departments created : ${result.departmentsCreated}`)
      console.log(`Workers created     : ${result.employeesCreated}`)
      console.log(`Workers reassigned  : ${result.employeesReassigned}`)
      console.log(`Workers unchanged   : ${result.employeesUnchanged}`)
      if (result.unmatchedDepartmentCodes.length > 0) {
        console.log(
          `\n⚠ Unmatched department codes (workers skipped): ${result.unmatchedDepartmentCodes.join(', ')}`,
        )
      }
      if (!apply) {
        throw new DryRunRollback()
      }
    })
  } catch (error) {
    if (!(error instanceof DryRunRollback)) {
      throw error
    }
  } finally {
    await pool.end()
  }

  console.log(
    apply
      ? '\nDone — roster loaded.'
      : '\nDry run complete — review above, then re-run with --apply.',
  )
}

await main()
