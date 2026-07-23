import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import * as schema from '../../schema/index.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

/**
 * Proves the PRODUCTION `createDb` factory produces a client whose relational
 * query API (`db.query.<table>.findFirst({ with: … })`) actually works at
 * runtime. Before the schema was passed to `drizzle()`, `db.query` was
 * `undefined` — the types said otherwise via an `as unknown as` cast, so nothing
 * caught it. This test would have failed then; the hand-written `select().join()`
 * queries are unaffected and keep their own coverage.
 */
describe('createDb relational query API', () => {
  const pools: { end: () => Promise<void> }[] = []

  afterEach(async () => {
    while (pools.length > 0) {
      await pools.pop()?.end()
    }
  })

  it('exposes db.query and resolves a one-to-one relation to real nested data', async () => {
    const pool = createPool(getIntegrationDatabaseUrl())
    pools.push(pool)
    const db = createDb(pool)

    // The namespace only exists when the schema is wired into the client.
    expect(db.query).toBeDefined()

    const customerId = randomUUID()
    const customerName = `REL-CUST-${customerId.slice(0, 8)}`
    await db
      .insert(schema.customers)
      .values({ id: customerId, kind: 'emotive_partner', name: customerName })

    const sourceId = randomUUID()
    await db.insert(schema.claimSources).values({
      id: sourceId,
      code: `REL-SRC-${sourceId.slice(0, 8)}`,
      name: `REL source ${sourceId.slice(0, 8)}`,
      defaultCustomerId: customerId,
    })

    const source = await db.query.claimSources.findFirst({
      where: eq(schema.claimSources.id, sourceId),
      with: { defaultCustomer: true },
    })

    expect(source?.defaultCustomer?.name).toBe(customerName)

    await db.delete(schema.claimSources).where(eq(schema.claimSources.id, sourceId))
    await db.delete(schema.customers).where(eq(schema.customers.id, customerId))
  })
})
