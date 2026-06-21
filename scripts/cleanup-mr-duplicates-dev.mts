#!/usr/bin/env tsx
/**
 * Dev-only cleanup: soft-delete duplicate MR claim rows, keeping one winner per mr_key.
 *
 * Winner rule: earliest created_at; tie-break by lowest claim id (deterministic).
 * Cross-table groups keep a single global winner across emotive + domace.
 *
 * Default mode is READ-ONLY dry-run. To apply changes:
 *   pnpm cleanup:mr-duplicates-dev -- --execute --confirm=cleanup-mr-duplicates-dev
 *
 * Safety:
 *   - Refuses non-local DATABASE_URL hosts (localhost:5433 only)
 *   - Never targets production
 *   - Sets deleted_at / updated_at only (no hard delete)
 *
 * Usage:
 *   pnpm cleanup:mr-duplicates-dev
 *   pnpm cleanup:mr-duplicates-dev -- --json
 *   pnpm cleanup:mr-duplicates-dev -- --limit=10
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb, createPool, getDatabaseUrl, schema } from '@mr/db'
import { config } from 'dotenv'
import { and, eq, isNull } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import {
  assertDevDatabase,
  buildCleanupPlan,
  buildDuplicateGroups,
  databaseHost,
  fetchActiveMrRows,
  type CleanupPlanGroup,
  type DuplicateClaimRef,
} from './mr-duplicate-lib.mts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const EXECUTE_CONFIRM_TOKEN = 'cleanup-mr-duplicates-dev'

config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })
config({ path: resolve(repoRoot, 'apps/api/.env') })

interface CleanupReport {
  generatedAt: string
  mode: 'dry-run' | 'execute'
  databaseHost: string
  winnerRule: 'earliest created_at, then lowest id'
  duplicateGroups: number
  winnersKept: number
  claimsToSoftDelete: number
  emotiveSoftDeletes: number
  domaceSoftDeletes: number
  crossTableGroups: number
  plan: CleanupPlanGroup[]
  truncated: boolean
  executedSoftDeletes?: number
}

function parseArgs(argv: string[]): {
  json: boolean
  limit: number | null
  execute: boolean
  confirm: string | null
} {
  let json = false
  let limit: number | null = null
  let execute = false
  let confirm: string | null = null

  for (const arg of argv) {
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--execute') {
      execute = true
      continue
    }
    if (arg.startsWith('--limit=')) {
      const value = Number.parseInt(arg.slice('--limit='.length), 10)
      if (!Number.isFinite(value) || value < 1) {
        throw new Error(`Invalid --limit value: ${arg}`)
      }
      limit = value
    }
    if (arg.startsWith('--confirm=')) {
      confirm = arg.slice('--confirm='.length)
    }
  }

  return { json, limit, execute, confirm }
}

function countByKind(claims: DuplicateClaimRef[]): { emotive: number; domace: number } {
  let emotive = 0
  let domace = 0
  for (const claim of claims) {
    if (claim.kind === 'emotive') {
      emotive += 1
    } else {
      domace += 1
    }
  }
  return { emotive, domace }
}

function buildReport(
  plan: CleanupPlanGroup[],
  mode: 'dry-run' | 'execute',
  limit: number | null,
  executedSoftDeletes?: number,
): CleanupReport {
  const allLosers = plan.flatMap((group) => group.losers)
  const loserCounts = countByKind(allLosers)
  const visiblePlan = limit === null ? plan : plan.slice(0, limit)

  return {
    generatedAt: new Date().toISOString(),
    mode,
    databaseHost: databaseHost(getDatabaseUrl()),
    winnerRule: 'earliest created_at, then lowest id',
    duplicateGroups: plan.length,
    winnersKept: plan.length,
    claimsToSoftDelete: allLosers.length,
    emotiveSoftDeletes: loserCounts.emotive,
    domaceSoftDeletes: loserCounts.domace,
    crossTableGroups: plan.filter((group) => group.crossTable).length,
    plan: visiblePlan,
    truncated: limit !== null && plan.length > visiblePlan.length,
    ...(executedSoftDeletes === undefined ? {} : { executedSoftDeletes }),
  }
}

function printHumanReport(report: CleanupReport): void {
  console.log(`MR DUPLICATE DEV CLEANUP (${report.mode.toUpperCase()})`)
  console.log('='.repeat(60))
  console.log(`Database: ${report.databaseHost}`)
  console.log(`Winner rule: ${report.winnerRule}`)
  console.log('')

  console.log('SUMMARY')
  console.log('-'.repeat(60))
  console.log(`Duplicate groups:             ${report.duplicateGroups}`)
  console.log(`Winners kept:                 ${report.winnersKept}`)
  console.log(`Claims to soft-delete:        ${report.claimsToSoftDelete}`)
  console.log(`  emotive soft-deletes:       ${report.emotiveSoftDeletes}`)
  console.log(`  domace soft-deletes:        ${report.domaceSoftDeletes}`)
  console.log(`Cross-table groups:           ${report.crossTableGroups}`)
  if (report.executedSoftDeletes !== undefined) {
    console.log(`Executed soft-deletes:        ${report.executedSoftDeletes}`)
  }
  console.log('')

  if (report.duplicateGroups === 0) {
    console.log('✓ No duplicate mr_key groups — nothing to clean up.')
    return
  }

  console.log('PLAN (one winner per mr_key)')
  console.log('-'.repeat(60))
  if (report.truncated) {
    console.log(`(showing first ${report.plan.length} groups; use --limit to adjust)`)
    console.log('')
  }

  for (const group of report.plan) {
    const scopeLabel = group.crossTable
      ? 'cross-table'
      : group.winner.kind === 'emotive'
        ? 'emotive-only'
        : 'domace-only'
    console.log(`[${scopeLabel}] mr_key="${group.mrKey}" losers=${group.losers.length}`)
    console.log(
      `  KEEP  ${group.winner.kind} id=${group.winner.id} mr_number=${JSON.stringify(group.winner.mrNumber)} created_at=${group.winner.createdAt}`,
    )
    for (const loser of group.losers) {
      console.log(
        `  DROP  ${loser.kind} id=${loser.id} mr_number=${JSON.stringify(loser.mrNumber)} created_at=${loser.createdAt}`,
      )
    }
    console.log('')
  }

  if (report.mode === 'dry-run') {
    console.log('Dry-run only — no rows changed.')
    console.log(
      `To apply: pnpm cleanup:mr-duplicates-dev -- --execute --confirm=${EXECUTE_CONFIRM_TOKEN}`,
    )
  } else {
    console.log('✓ Soft-delete cleanup applied.')
  }
}

async function softDeleteClaim(
  db: NodePgDatabase<typeof schema>,
  claim: DuplicateClaimRef,
): Promise<boolean> {
  const now = new Date()

  if (claim.kind === 'emotive') {
    const result = await db
      .update(schema.emotiveClaims)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(schema.emotiveClaims.id, claim.id), isNull(schema.emotiveClaims.deletedAt)))
    return result.rowCount > 0
  }

  const result = await db
    .update(schema.domaceClaims)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(schema.domaceClaims.id, claim.id), isNull(schema.domaceClaims.deletedAt)))
  return result.rowCount > 0
}

async function main(): Promise<void> {
  const { json, limit, execute, confirm } = parseArgs(process.argv.slice(2))
  const databaseUrl = getDatabaseUrl()
  assertDevDatabase(databaseUrl)

  if (execute && confirm !== EXECUTE_CONFIRM_TOKEN) {
    throw new Error(
      `Execute requires --confirm=${EXECUTE_CONFIRM_TOKEN} (got ${confirm ?? 'none'})`,
    )
  }

  const pool = createPool(databaseUrl)
  const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

  try {
    const rows = await fetchActiveMrRows(db)
    const duplicateGroups = buildDuplicateGroups(rows)
    const plan = buildCleanupPlan(duplicateGroups)
    const mode = execute ? 'execute' : 'dry-run'

    let executedSoftDeletes: number | undefined
    if (execute) {
      executedSoftDeletes = 0
      for (const group of plan) {
        for (const loser of group.losers) {
          const deleted = await softDeleteClaim(db, loser)
          if (deleted) {
            executedSoftDeletes += 1
          }
        }
      }
    }

    const report = buildReport(plan, mode, limit, executedSoftDeletes)

    if (json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printHumanReport(report)
      if (report.truncated) {
        console.log(
          `Note: ${plan.length - report.plan.length} more group(s) omitted; re-run without --limit or increase it.`,
        )
      }
    }
  } finally {
    await pool.end()
  }
}

main().catch((err: unknown) => {
  console.error('✗ MR duplicate dev cleanup failed:', err)
  process.exit(2)
})
