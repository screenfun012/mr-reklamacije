import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createDb, createPool, getDatabaseUrl } from '../../client.js'

describe('database (integration)', () => {
  it('connects with DATABASE_URL and runs SELECT 1 via Drizzle', async () => {
    const pool = createPool(getDatabaseUrl())
    const db = createDb(pool)

    try {
      const result = await db.execute(sql`SELECT 1::integer AS one`)
      expect(result.rows[0]).toEqual({ one: 1 })
    } finally {
      await pool.end()
    }
  })
})
