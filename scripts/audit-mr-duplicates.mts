#!/usr/bin/env tsx
/**
 * Pre-migration audit: active claims whose normalized mr_key would collide
 * under global mr_registry UNIQUE(mr_key).
 *
 * Same normalization as future MrRegistryService (@mr/shared normalizeMrKey):
 * trim, collapse whitespace, lowercase. NULL / empty mr_number is excluded.
 *
 * Usage:
 *   pnpm audit:mr-duplicates
 *   pnpm audit:mr-duplicates -- --json
 *   pnpm audit:mr-duplicates -- --limit=20
 *
 * Exit codes:
 *   0 — no duplicate mr_key groups (safe to backfill mr_registry)
 *   1 — duplicates found (migration must not run until resolved)
 *   2 — script / connection error
 *
 * Reads DATABASE_URL from apps/api/.env (same as create-admin).
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb, createPool, getDatabaseUrl, schema } from '@mr/db'
import { normalizeMrKey } from '@mr/shared'
import { config } from 'dotenv'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })
config({ path: resolve(repoRoot, 'apps/api/.env') })

type ClaimKind = 'emotive' | 'domace'

interface ActiveMrRow {
  kind: ClaimKind
  id: string
  mr_number: string
  created_at: Date
}

interface DuplicateClaimRef {
  kind: ClaimKind
  id: string
  mrNumber: string
  createdAt: string
}

interface DuplicateGroup {
  mrKey: string
  rawVariants: string[]
  emotiveCount: number
  domaceCount: number
  totalCount: number
  crossTable: boolean
  claims: DuplicateClaimRef[]
}

interface AuditSummary {
  activeEmotiveTotal: number
  activeDomaceTotal: number
  activeEmotiveWithMr: number
  activeDomaceWithMr: number
  activeDomaceNullMr: number
  duplicateGroupCount: number
  withinEmotiveGroups: number
  withinDomaceGroups: number
  crossTableGroups: number
  claimsInDuplicateGroups: number
}

interface AuditReport {
  generatedAt: string
  databaseHost: string
  scope: 'active claims only (deleted_at IS NULL)'
  normalization: 'trim + collapse whitespace + lowercase; MR prefix not stripped'
  summary: AuditSummary
  duplicateGroups: DuplicateGroup[]
  truncated: boolean
}

function parseArgs(argv: string[]): { json: boolean; limit: number | null } {
  let json = false
  let limit: number | null = null

  for (const arg of argv) {
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg.startsWith('--limit=')) {
      const value = Number.parseInt(arg.slice('--limit='.length), 10)
      if (!Number.isFinite(value) || value < 1) {
        throw new Error(`Invalid --limit value: ${arg}`)
      }
      limit = value
    }
  }

  return { json, limit }
}

function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.password !== '') {
      parsed.password = '***'
    }
    return parsed.toString()
  } catch {
    return '(invalid DATABASE_URL)'
  }
}

function databaseHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'unknown'
  }
}

async function fetchActiveMrRows(db: NodePgDatabase<typeof schema>): Promise<ActiveMrRow[]> {
  const result = await db.execute<ActiveMrRow>(sql`
    SELECT 'emotive'::text AS kind, id::text, mr_number, created_at
    FROM emotive_claims
    WHERE deleted_at IS NULL AND mr_number IS NOT NULL
    UNION ALL
    SELECT 'domace'::text, id::text, mr_number, created_at
    FROM domace_claims
    WHERE deleted_at IS NULL AND mr_number IS NOT NULL
  `)

  return result.rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    mr_number: row.mr_number,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  }))
}

async function fetchNullMrStats(db: NodePgDatabase<typeof schema>): Promise<{
  activeEmotiveTotal: number
  activeDomaceTotal: number
  activeEmotiveWithMr: number
  activeDomaceWithMr: number
  activeDomaceNullMr: number
}> {
  const result = await db.execute<{
    active_emotive_total: string
    active_domace_total: string
    active_emotive_with_mr: string
    active_domace_with_mr: string
    active_domace_null_mr: string
  }>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM emotive_claims WHERE deleted_at IS NULL) AS active_emotive_total,
      (SELECT COUNT(*)::text FROM domace_claims WHERE deleted_at IS NULL) AS active_domace_total,
      (SELECT COUNT(*)::text FROM emotive_claims WHERE deleted_at IS NULL AND mr_number IS NOT NULL)
        AS active_emotive_with_mr,
      (SELECT COUNT(*)::text FROM domace_claims WHERE deleted_at IS NULL AND mr_number IS NOT NULL)
        AS active_domace_with_mr,
      (SELECT COUNT(*)::text FROM domace_claims WHERE deleted_at IS NULL AND mr_number IS NULL)
        AS active_domace_null_mr
  `)

  const row = result.rows[0]
  if (row === undefined) {
    throw new Error('Failed to load MR null stats')
  }

  return {
    activeEmotiveTotal: Number.parseInt(row.active_emotive_total, 10),
    activeDomaceTotal: Number.parseInt(row.active_domace_total, 10),
    activeEmotiveWithMr: Number.parseInt(row.active_emotive_with_mr, 10),
    activeDomaceWithMr: Number.parseInt(row.active_domace_with_mr, 10),
    activeDomaceNullMr: Number.parseInt(row.active_domace_null_mr, 10),
  }
}

function buildDuplicateGroups(rows: ActiveMrRow[]): DuplicateGroup[] {
  const byKey = new Map<string, DuplicateGroup>()

  for (const row of rows) {
    const mrKey = normalizeMrKey(row.mr_number)
    if (mrKey === null) {
      continue
    }

    let group = byKey.get(mrKey)
    if (group === undefined) {
      group = {
        mrKey,
        rawVariants: [],
        emotiveCount: 0,
        domaceCount: 0,
        totalCount: 0,
        crossTable: false,
        claims: [],
      }
      byKey.set(mrKey, group)
    }

    if (!group.rawVariants.includes(row.mr_number)) {
      group.rawVariants.push(row.mr_number)
    }

    if (row.kind === 'emotive') {
      group.emotiveCount += 1
    } else {
      group.domaceCount += 1
    }
    group.totalCount += 1
    group.claims.push({
      kind: row.kind,
      id: row.id,
      mrNumber: row.mr_number,
      createdAt: row.created_at.toISOString(),
    })
  }

  const duplicates = [...byKey.values()].filter((group) => group.totalCount > 1)

  for (const group of duplicates) {
    group.crossTable = group.emotiveCount > 0 && group.domaceCount > 0
    group.rawVariants.sort()
    group.claims.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  duplicates.sort((a, b) => {
    if (b.totalCount !== a.totalCount) {
      return b.totalCount - a.totalCount
    }
    return a.mrKey.localeCompare(b.mrKey)
  })

  return duplicates
}

function buildSummary(
  stats: Awaited<ReturnType<typeof fetchNullMrStats>>,
  duplicateGroups: DuplicateGroup[],
): AuditSummary {
  const withinEmotiveGroups = duplicateGroups.filter(
    (group) => group.emotiveCount > 1 && group.domaceCount === 0,
  ).length
  const withinDomaceGroups = duplicateGroups.filter(
    (group) => group.domaceCount > 1 && group.emotiveCount === 0,
  ).length
  const crossTableGroups = duplicateGroups.filter((group) => group.crossTable).length

  return {
    ...stats,
    duplicateGroupCount: duplicateGroups.length,
    withinEmotiveGroups,
    withinDomaceGroups,
    crossTableGroups,
    claimsInDuplicateGroups: duplicateGroups.reduce((sum, group) => sum + group.totalCount, 0),
  }
}

function printHumanReport(report: AuditReport): void {
  console.log('MR DUPLICATE AUDIT (pre mr_registry migration)')
  console.log('='.repeat(60))
  console.log(`Database: ${report.databaseHost}`)
  console.log(`Scope: ${report.scope}`)
  console.log(`Normalization: ${report.normalization}`)
  console.log('')

  const { summary } = report
  console.log('SUMMARY')
  console.log('-'.repeat(60))
  console.log(`Active emotive claims:        ${summary.activeEmotiveTotal}`)
  console.log(`Active domace claims:         ${summary.activeDomaceTotal}`)
  console.log(`Emotive with mr_number:       ${summary.activeEmotiveWithMr}`)
  console.log(`Domace with mr_number:        ${summary.activeDomaceWithMr}`)
  console.log(`Domace NULL mr_number:        ${summary.activeDomaceNullMr}`)
  console.log('')
  console.log(`Duplicate mr_key groups:      ${summary.duplicateGroupCount}`)
  console.log(`  within emotive only:        ${summary.withinEmotiveGroups}`)
  console.log(`  within domace only:         ${summary.withinDomaceGroups}`)
  console.log(`  cross-table (E + D):        ${summary.crossTableGroups}`)
  console.log(`Claims in duplicate groups:   ${summary.claimsInDuplicateGroups}`)
  console.log('')

  if (report.duplicateGroups.length === 0) {
    console.log('✓ No duplicate mr_key groups — safe to run mr_registry backfill.')
    return
  }

  console.log('DUPLICATE GROUPS (sorted by count desc)')
  console.log('-'.repeat(60))
  if (report.truncated) {
    console.log(`(showing first ${report.duplicateGroups.length} groups; use --limit to adjust)`)
    console.log('')
  }

  for (const group of report.duplicateGroups) {
    const scopeLabel = group.crossTable
      ? 'cross-table'
      : group.emotiveCount > 0
        ? 'emotive-only'
        : 'domace-only'
    console.log(
      `[${scopeLabel}] mr_key="${group.mrKey}" total=${group.totalCount} (E=${group.emotiveCount}, D=${group.domaceCount})`,
    )
    console.log(`  raw variants: ${group.rawVariants.map((v) => JSON.stringify(v)).join(', ')}`)
    for (const claim of group.claims) {
      console.log(
        `  - ${claim.kind} id=${claim.id} mr_number=${JSON.stringify(claim.mrNumber)} created_at=${claim.createdAt}`,
      )
    }
    console.log('')
  }

  console.log('✗ Duplicates found — resolve before mr_registry migration (fail-on-conflict).')
}

async function main(): Promise<void> {
  const { json, limit } = parseArgs(process.argv.slice(2))
  const databaseUrl = getDatabaseUrl()
  const pool = createPool(databaseUrl)
  const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

  try {
    const [stats, rows] = await Promise.all([fetchNullMrStats(db), fetchActiveMrRows(db)])
    const allDuplicateGroups = buildDuplicateGroups(rows)
    const duplicateGroups = limit === null ? allDuplicateGroups : allDuplicateGroups.slice(0, limit)

    const report: AuditReport = {
      generatedAt: new Date().toISOString(),
      databaseHost: databaseHost(databaseUrl),
      scope: 'active claims only (deleted_at IS NULL)',
      normalization: 'trim + collapse whitespace + lowercase; MR prefix not stripped',
      summary: buildSummary(stats, allDuplicateGroups),
      duplicateGroups,
      truncated: limit !== null && allDuplicateGroups.length > duplicateGroups.length,
    }

    if (json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      printHumanReport(report)
      if (report.truncated) {
        console.log(
          `Note: ${allDuplicateGroups.length - duplicateGroups.length} more group(s) omitted; re-run without --limit or increase it.`,
        )
      }
    }

    if (allDuplicateGroups.length > 0) {
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}

main().catch((err: unknown) => {
  console.error('✗ MR duplicate audit failed:', err)
  process.exit(2)
})
