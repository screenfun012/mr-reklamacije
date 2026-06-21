import { normalizeMrKey } from '@mr/shared'
import { schema } from '@mr/db'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export type ClaimKind = 'emotive' | 'domace'

export interface ActiveMrRow {
  kind: ClaimKind
  id: string
  mr_number: string
  created_at: Date
}

export interface DuplicateClaimRef {
  kind: ClaimKind
  id: string
  mrNumber: string
  createdAt: string
}

export interface DuplicateGroup {
  mrKey: string
  rawVariants: string[]
  emotiveCount: number
  domaceCount: number
  totalCount: number
  crossTable: boolean
  claims: DuplicateClaimRef[]
}

export interface AuditSummary {
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

export interface CleanupPlanGroup {
  mrKey: string
  crossTable: boolean
  winner: DuplicateClaimRef
  losers: DuplicateClaimRef[]
}

export function databaseHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'unknown'
  }
}

const DEV_DATABASE_HOSTS = new Set(['localhost:5433', '127.0.0.1:5433'])

export function assertDevDatabase(url: string): void {
  const host = databaseHost(url)
  if (!DEV_DATABASE_HOSTS.has(host)) {
    throw new Error(
      `Refusing dev MR cleanup on non-local database host "${host}". ` +
        'Expected localhost:5433 (docker compose dev Postgres).',
    )
  }
}

export async function fetchActiveMrRows(db: NodePgDatabase<typeof schema>): Promise<ActiveMrRow[]> {
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

export async function fetchNullMrStats(db: NodePgDatabase<typeof schema>): Promise<{
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

export function buildDuplicateGroups(rows: ActiveMrRow[]): DuplicateGroup[] {
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
    group.claims.sort((a, b) => compareClaimsForWinner(a, b))
  }

  duplicates.sort((a, b) => {
    if (b.totalCount !== a.totalCount) {
      return b.totalCount - a.totalCount
    }
    return a.mrKey.localeCompare(b.mrKey)
  })

  return duplicates
}

/** Earliest created_at wins; tie-break by lowest UUID for determinism. */
export function compareClaimsForWinner(a: DuplicateClaimRef, b: DuplicateClaimRef): number {
  const byTime = a.createdAt.localeCompare(b.createdAt)
  if (byTime !== 0) {
    return byTime
  }
  return a.id.localeCompare(b.id)
}

export function buildSummary(
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

export function buildCleanupPlan(duplicateGroups: DuplicateGroup[]): CleanupPlanGroup[] {
  return duplicateGroups.map((group) => {
    const sorted = [...group.claims].sort(compareClaimsForWinner)
    const winner = sorted[0]
    if (winner === undefined) {
      throw new Error(`Duplicate group "${group.mrKey}" has no claims`)
    }

    return {
      mrKey: group.mrKey,
      crossTable: group.crossTable,
      winner,
      losers: sorted.slice(1),
    }
  })
}
