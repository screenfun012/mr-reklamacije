import { schema } from '@mr/db'
import { ClaimOutcome, CustomerKind, UserAccountStatus } from '@mr/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Container } from '../../../core/container.js'
import { RecordingEmailPort } from '../../../test-helpers/recording-email-port.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const ACTOR = {
  id: TEST_USER_ID,
  permissions: ['emotive_claims.view', 'emotive_claims.create', 'emotive_claims.change_outcome'],
}

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

describe('EMOTIVE outcome-change client email', () => {
  let ctx: TestDbContext
  let container: Container
  let email: RecordingEmailPort
  const runId = Date.now()

  beforeEach(async () => {
    ctx = await createTestDbContext()
    email = new RecordingEmailPort()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, undefined, email)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function seedPortalUser(
    emailAddress: string,
    accountStatus: UserAccountStatus = UserAccountStatus.Approved,
  ): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db
      .insert(schema.users)
      .values({ id, email: emailAddress, name: 'Portal Klijent', accountStatus })
    return id
  }

  async function seedCustomerWithUser(emailAddress: string): Promise<string> {
    const [customer] = await ctx.db
      .insert(schema.customers)
      .values({ kind: CustomerKind.EmotivePartner, name: `Email Partner ${crypto.randomUUID()}` })
      .returning({ id: schema.customers.id })
    const userId = await seedPortalUser(emailAddress)
    await ctx.db
      .insert(schema.customerUsers)
      .values({ customerId: customer!.id, userId, assignedBy: TEST_USER_ID })
    return customer!.id
  }

  async function createClaim(mrNumber: string, customerId?: string): Promise<string> {
    const [engineType] = await ctx.db
      .insert(schema.engineTypes)
      .values({ code: `EMAIL-ET-${crypto.randomUUID()}` })
      .returning({ id: schema.engineTypes.id })

    const claim = await container.emotiveClaimsService.create(
      {
        engineTypeId: engineType!.id,
        dateOfClaim: new Date(),
        mrNumber,
        outcome: ClaimOutcome.Pending,
        warrantyReport: 'Outcome email test',
        faults: [],
        ...(customerId !== undefined ? { customerId } : {}),
      },
      ACTOR,
      auditContext,
    )
    return claim.id
  }

  it('emails approved portal users of the claim customer, signal-only', async () => {
    const recipient = `client-${runId}-a@mrengines.rs`
    const customerId = await seedCustomerWithUser(recipient)
    // A pending (not yet approved) account on the same customer must NOT get email.
    const pendingUserId = await seedPortalUser(
      `client-${runId}-pending@mrengines.rs`,
      UserAccountStatus.Pending,
    )
    await ctx.db
      .insert(schema.customerUsers)
      .values({ customerId, userId: pendingUserId, assignedBy: TEST_USER_ID })

    // A claim WITHOUT a customer changes outcome first — it must stay silent,
    // so the single recorded email below also proves this path sent nothing.
    const orphanId = await createClaim(`EMAIL-ORPHAN/${runId}`)
    await container.emotiveClaimsService.changeOutcome(
      orphanId,
      { outcome: ClaimOutcome.Rejected },
      ACTOR,
      auditContext,
    )

    const mrNumber = `EMAIL-CUST/${runId}`
    const claimId = await createClaim(mrNumber, customerId)
    await container.emotiveClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Accepted },
      ACTOR,
      auditContext,
    )

    await vi.waitFor(() => expect(email.sent).toHaveLength(1))
    const sent = email.sent[0]!
    expect(sent.to).toBe(recipient)
    expect(sent.subject).toContain(mrNumber)
    // Signal-only: the email must not leak the outcome itself.
    expect(sent.html).not.toMatch(/accepted|prihvać/i)
    expect(sent.html).toContain(mrNumber)
  })

  it('respects the notify_client_on_outcome=false admin toggle', async () => {
    await ctx.db.insert(schema.appSettings).values({
      key: 'emotive_claims.notify_client_on_outcome',
      value: 'false',
      valueType: 'boolean',
    })

    const customerId = await seedCustomerWithUser(`client-${runId}-b@mrengines.rs`)
    const claimId = await createClaim(`EMAIL-TOGGLE/${runId}`, customerId)
    await container.emotiveClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Accepted },
      ACTOR,
      auditContext,
    )

    // The disabled path exits after one settings read; give it time to land.
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(email.sent).toHaveLength(0)
  })
})
