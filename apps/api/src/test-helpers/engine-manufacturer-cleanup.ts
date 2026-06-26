import { randomUUID } from 'node:crypto'

import type pg from 'pg'

/** Legacy fixed codes that leaked when a test connection committed outside ROLLBACK. */
export const LEGACY_LEAKED_ENGINE_MANUFACTURER_CODES = ['TEST-BMW'] as const

export function uniqueFixtureEngineManufacturerCode(prefix = 'FIXTURE-MFG'): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`
}

/**
 * Permanently removes committed test manufacturers (autocommit).
 * Test transactions cannot delete rows committed by another connection — this runs outside the test tx.
 */
export async function purgeCommittedEngineManufacturersByCode(
  pool: pg.Pool,
  codes: readonly string[],
): Promise<void> {
  if (codes.length === 0) {
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const code of codes) {
      const manufacturer = await client.query<{ id: string }>(
        `SELECT id FROM engine_manufacturers WHERE code = $1 AND deleted_at IS NULL LIMIT 1`,
        [code],
      )
      const manufacturerId = manufacturer.rows[0]?.id
      if (manufacturerId === undefined) {
        continue
      }

      await client.query(
        `DELETE FROM emotive_claim_faults
         WHERE claim_id IN (
           SELECT id FROM emotive_claims
           WHERE manufacturer_id = $1
              OR engine_type_id IN (SELECT id FROM engine_types WHERE manufacturer_id = $1)
         )`,
        [manufacturerId],
      )
      await client.query(
        `DELETE FROM emotive_claims
         WHERE manufacturer_id = $1
            OR engine_type_id IN (SELECT id FROM engine_types WHERE manufacturer_id = $1)`,
        [manufacturerId],
      )
      await client.query(
        `DELETE FROM domace_claim_faults
         WHERE claim_id IN (SELECT id FROM domace_claims WHERE manufacturer_id = $1)`,
        [manufacturerId],
      )
      await client.query(`DELETE FROM domace_claims WHERE manufacturer_id = $1`, [manufacturerId])
      await client.query(`DELETE FROM engine_types WHERE manufacturer_id = $1`, [manufacturerId])
      await client.query(
        `DELETE FROM audit_log WHERE entity_type = 'engine_manufacturer' AND entity_id = $1`,
        [manufacturerId],
      )
      await client.query(`DELETE FROM engine_manufacturers WHERE id = $1`, [manufacturerId])
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
