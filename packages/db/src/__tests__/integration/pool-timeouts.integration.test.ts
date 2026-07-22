import { afterEach, describe, expect, it } from 'vitest'

import { createPool } from '../../client.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

/**
 * The pool's timeouts are the difference between "a slow query is killed" and
 * "requests hang forever behind a healthcheck that still says ok" (docs/22 §1.1).
 * They are also opt-in on purpose — the deploy migrator shares this factory, and a
 * statement timeout there would abort a long index build and fail the deploy.
 */
describe('createPool timeouts', () => {
  const pools: { end: () => Promise<void> }[] = []

  afterEach(async () => {
    while (pools.length > 0) {
      await pools.pop()?.end()
    }
  })

  it('leaves statements unlimited by default, so migrations are never cut off', async () => {
    const pool = createPool(getIntegrationDatabaseUrl())
    pools.push(pool)

    const result = await pool.query<{ statement_timeout: string }>('SHOW statement_timeout')

    // Postgres reports "0" when there is no limit.
    expect(result.rows[0]?.statement_timeout).toBe('0')
  })

  it('applies statement_timeout when the caller asks for one', async () => {
    const pool = createPool(getIntegrationDatabaseUrl(), { statementTimeoutMillis: 250 })
    pools.push(pool)

    // Proves the setting actually reaches Postgres, not just the config object.
    await expect(pool.query('SELECT pg_sleep(2)')).rejects.toThrow(
      /statement timeout|canceling statement/i,
    )
  })

  it('applies idle_in_transaction_session_timeout when asked', async () => {
    const pool = createPool(getIntegrationDatabaseUrl(), {
      idleInTransactionTimeoutMillis: 30_000,
    })
    pools.push(pool)

    const result = await pool.query<{ idle_in_transaction_session_timeout: string }>(
      'SHOW idle_in_transaction_session_timeout',
    )

    expect(result.rows[0]?.idle_in_transaction_session_timeout).toBe('30s')
  })
})
