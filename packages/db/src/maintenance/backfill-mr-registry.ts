import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '../schema/index.js'
import { sqlNormalizeMrKey } from '../sql/normalize-mr-key-sql.js'

/**
 * Registers every active claim's MR number in mr_registry — the SQL twin of
 * `normalizeMrKey` (trim, collapse whitespace, lowercase), identical to the
 * migration-0010 backfill. Idempotent (ON CONFLICT DO NOTHING). Needed after
 * any path that inserts claims directly (legacy import) instead of going
 * through MrRegistryService.claimMr — without it, duplicate protection and
 * the create-form warning silently skip those claims (prod incident
 * 2026-07-17: registry held 3 of 127 numbers). Returns the inserted count.
 */
export async function backfillMrRegistry(db: NodePgDatabase<typeof schema>): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO mr_registry (mr_key, claim_kind, emotive_claim_id, domace_claim_id, created_at)
    SELECT
      ${sqlNormalizeMrKey(sql.raw('mr_number'))} AS mr_key,
      'emotive'::text,
      id,
      NULL::uuid,
      created_at
    FROM emotive_claims
    WHERE deleted_at IS NULL
      AND mr_number IS NOT NULL
      AND trim(mr_number) <> ''
    UNION ALL
    SELECT
      ${sqlNormalizeMrKey(sql.raw('mr_number'))},
      'domace'::text,
      NULL::uuid,
      id,
      created_at
    FROM domace_claims
    WHERE deleted_at IS NULL
      AND mr_number IS NOT NULL
      AND trim(mr_number) <> ''
    ON CONFLICT (mr_key) DO NOTHING
  `)

  return result.rowCount ?? 0
}
