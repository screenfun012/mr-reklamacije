import { schema } from '@mr/db'
import { ClaimOutcome, CustomerKind, UserAccountStatus } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Container } from '../../../core/container.js'
import { RecordingEmailPort } from '../../../test-helpers/recording-email-port.js'
import {
  ensureTestUser,
  getClaimCategoryIdByCode,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

// Mirrors the service's admin-hook key (packages/db has no shared constant for it).
const NOTIFY_CLIENT_SETTING_KEY = 'emotive_claims.notify_client_on_outcome'

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
        categoryId: await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA'),
        dateOfClaim: new Date(),
        mrNumber,
        outcome: ClaimOutcome.Pending,
        warrantyReport: 'Outcome email test',
        faults: [],
        findings: [],
        ...(customerId !== undefined ? { customerId } : {}),
      },
      ACTOR,
      auditContext,
    )
    return claim.id
  }

  it('emails approved portal users of the claim customer, signal-only, once published', async () => {
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
    // Gate B: the claim is private (published_at IS NULL) until explicitly published —
    // the email only fires once the decided outcome is client-visible.
    await container.emotiveClaimsService.publish(claimId, auditContext)
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

  it('does not email when the outcome changes while the claim is still private', async () => {
    const customerId = await seedCustomerWithUser(`client-${runId}-private@mrengines.rs`)
    const claimId = await createClaim(`EMAIL-PRIVATE/${runId}`, customerId)

    await container.emotiveClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Accepted },
      ACTOR,
      auditContext,
    )

    // Negative assertion — give the fire-and-settle notify a chance to land, then
    // confirm nothing did (published_at is still null).
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(email.sent).toHaveLength(0)
  })

  it('emails when publish reveals a claim whose outcome is already decided', async () => {
    const recipient = `client-${runId}-publish@mrengines.rs`
    const customerId = await seedCustomerWithUser(recipient)
    const claimId = await createClaim(`EMAIL-PUBLISH/${runId}`, customerId)

    await container.emotiveClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Accepted },
      ACTOR,
      auditContext,
    )
    // Deciding while still private must stay silent — asserted here (not just at the
    // end) so this test actually proves publish is what triggers the send below.
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(email.sent).toHaveLength(0)

    await container.emotiveClaimsService.publish(claimId, auditContext)

    await vi.waitFor(() => expect(email.sent).toHaveLength(1))
    expect(email.sent[0]?.to).toBe(recipient)
  })

  it('publishing a still-pending claim stays silent; deciding it afterward emails once', async () => {
    const recipient = `client-${runId}-pending-publish@mrengines.rs`
    const customerId = await seedCustomerWithUser(recipient)
    const claimId = await createClaim(`EMAIL-PENDING-PUBLISH/${runId}`, customerId)

    await container.emotiveClaimsService.publish(claimId, auditContext)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(email.sent).toHaveLength(0)

    await container.emotiveClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Rejected },
      ACTOR,
      auditContext,
    )

    await vi.waitFor(() => expect(email.sent).toHaveLength(1))
    expect(email.sent[0]?.to).toBe(recipient)
  })

  it('re-deciding an already-published claim emails again (it is an update to the client)', async () => {
    const recipient = `client-${runId}-redecide@mrengines.rs`
    const customerId = await seedCustomerWithUser(recipient)
    const claimId = await createClaim(`EMAIL-REDECIDE/${runId}`, customerId)

    await container.emotiveClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Accepted },
      ACTOR,
      auditContext,
    )
    // Silent while private (see the dedicated test above) — repeated here so the
    // count-2 assertion below can only be reached via the publish + re-decide sends.
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(email.sent).toHaveLength(0)

    await container.emotiveClaimsService.publish(claimId, auditContext)
    await vi.waitFor(() => expect(email.sent).toHaveLength(1))

    await container.emotiveClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Rejected },
      ACTOR,
      auditContext,
    )

    await vi.waitFor(() => expect(email.sent).toHaveLength(2))
  })

  // NOTE: `app_settings.key` is a PK and writes here are known to survive across
  // test runs (order-dependent flake) — upsert instead of a plain insert so a
  // leftover row from a prior run doesn't 23505, and delete it again afterward so a
  // leaked 'false' can't suppress the send-count assertions above on the next run.
  // Keep this test last for the same reason.
  it('respects the notify_client_on_outcome=false admin toggle', async () => {
    await ctx.db
      .insert(schema.appSettings)
      .values({
        key: NOTIFY_CLIENT_SETTING_KEY,
        value: 'false',
        valueType: 'boolean',
      })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value: 'false' },
      })

    try {
      const customerId = await seedCustomerWithUser(`client-${runId}-b@mrengines.rs`)
      const claimId = await createClaim(`EMAIL-TOGGLE/${runId}`, customerId)
      await container.emotiveClaimsService.changeOutcome(
        claimId,
        { outcome: ClaimOutcome.Accepted },
        ACTOR,
        auditContext,
      )
      await container.emotiveClaimsService.publish(claimId, auditContext)

      // The disabled path exits after one settings read; give it time to land.
      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(email.sent).toHaveLength(0)
    } finally {
      await ctx.db
        .delete(schema.appSettings)
        .where(eq(schema.appSettings.key, NOTIFY_CLIENT_SETTING_KEY))
    }
  })
})
