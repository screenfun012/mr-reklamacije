import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

describe('database (integration)', () => {
  it('connects with integration DATABASE_URL and runs SELECT 1 via Drizzle', async () => {
    const pool = createPool(getIntegrationDatabaseUrl())
    const db = createDb(pool)

    try {
      const result = await db.execute(sql`SELECT 1::integer AS one`)
      expect(result.rows[0]).toEqual({ one: 1 })
    } finally {
      await pool.end()
    }
  })
})
