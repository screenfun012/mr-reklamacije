import { schema } from '@mr/db'
import {
  AuditAction,
  ClaimKind,
  ClientSubmissionStatus,
  CustomerKind,
  EmotiveClaimCreateInputSchema,
  NotificationEntityType,
  NotificationType,
  SYSTEM_ROLE_OPERATOR,
  UserAccountStatus,
  SUPPORT_EMAIL_BY_KIND,
  type EmotiveClaimCreateInput,
} from '@mr/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  ForbiddenError,
  MrKeyConflictError,
  NotFoundError,
} from '../../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../../core/http/actor-context.js'
import type { EmailMessage, EmailPort } from '../../../core/ports/email-port.js'
import { DbAppSettingsReader } from '../../../core/settings/app-settings.reader.js'
import {
  ensureTestUser,
  getClaimCategoryIdByCode,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { RecordingEmailPort } from '../../../test-helpers/recording-email-port.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { ClientSubmissionsRepository } from '../client-submissions.repository.js'
import { ClientSubmissionsService } from '../client-submissions.service.js'

const INTERNAL_BASE_URL = 'http://127.0.0.1:3002'

/** Email port whose `send` blocks on an external gate — proves create() does not await it. */
class GatedEmailPort implements EmailPort {
  readonly enabled = true
  readonly sent: EmailMessage[] = []

  constructor(private readonly gate: Promise<void>) {}

  async send(message: EmailMessage): Promise<void> {
    await this.gate
    this.sent.push(message)
  }
}

// Submitter/handler for convert + reject (customer comes from the submission, not from
// customer_users, so the shared TEST_USER_ID is safe here).
const ACTOR: HttpActorContext = {
  actorUserId: TEST_USER_ID,
  actorIp: '203.0.113.7',
  actorUserAgent: 'vitest-agent',
}

function actorFor(userId: string): HttpActorContext {
  return { actorUserId: userId, actorIp: '203.0.113.7', actorUserAgent: 'vitest-agent' }
}

// The employee who converts a claim needs create + read rights on emotive claims.
const CONVERTER_ACTOR = {
  id: TEST_USER_ID,
  permissions: ['emotive_claims.create', 'emotive_claims.view'] as const,
}
const CONVERTER_AUDIT_CONTEXT = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }

function uniqueSuffix(): string {
  return crypto.randomUUID().slice(0, 8)
}

describe('ClientSubmissionsService integration', () => {
  let ctx: TestDbContext
  let container: Container
  let repository: ClientSubmissionsRepository
  let events: RecordingEventBus
  let email: RecordingEmailPort
  let service: ClientSubmissionsService
  // categoryId is required by EmotiveClaimCreateInputSchema (spec §3.3); resolved once per
  // test from the migration-seeded catalog row — category is irrelevant to what this suite tests.
  let defaultCategoryId: string

  async function buildClaimInput(
    overrides: Partial<EmotiveClaimCreateInput> = {},
  ): Promise<EmotiveClaimCreateInput> {
    const { engineTypeId, dateOfClaim, mrNumber, ...rest } = overrides
    return EmotiveClaimCreateInputSchema.parse({
      engineTypeId: engineTypeId ?? crypto.randomUUID(),
      categoryId: defaultCategoryId,
      dateOfClaim: dateOfClaim ?? new Date('2026-07-01'),
      mrNumber: mrNumber ?? `CS-CONV-${uniqueSuffix()}/26`,
      ...rest,
    })
  }
  // The convert path commits (db.transaction) on the shared single-connection harness, so
  // its rows are NOT rolled back with the test — track and delete them so the repository
  // suite's global `listPending` count stays accurate.
  let submissionCleanup: string[]
  let attachmentCleanup: string[]

  function makeService(emailPort: EmailPort): ClientSubmissionsService {
    return new ClientSubmissionsService(
      ctx.db,
      repository,
      container.emotiveClaimsService,
      emailPort,
      events,
      container.auditService,
      new DbAppSettingsReader(ctx.db),
      container.logger,
      INTERNAL_BASE_URL,
      container.notificationsService,
    )
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-13T10:00:00Z'))

    ctx = await createTestDbContext()
    events = new RecordingEventBus()
    email = new RecordingEmailPort()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, events, email)
    repository = new ClientSubmissionsRepository(ctx.db)
    service = makeService(email)
    submissionCleanup = []
    attachmentCleanup = []

    await ensureTestUser(ctx.db)
    defaultCategoryId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
  })

  afterEach(async () => {
    if (attachmentCleanup.length > 0) {
      await ctx.db
        .delete(schema.attachments)
        .where(inArray(schema.attachments.id, attachmentCleanup))
    }
    if (submissionCleanup.length > 0) {
      await ctx.db
        .delete(schema.clientSubmissions)
        .where(inArray(schema.clientSubmissions.id, submissionCleanup))
    }
    await ctx.cleanup()
    vi.useRealTimers()
  })

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db
      .insert(schema.users)
      .values({ id, email: `cs-${id}@mrengines.rs`, name: 'CS User' })
    return id
  }

  async function seedCustomer(
    name: string,
    kind: CustomerKind = CustomerKind.EmotivePartner,
  ): Promise<string> {
    const [customer] = await ctx.db
      .insert(schema.customers)
      .values({ kind, name })
      .returning({ id: schema.customers.id })
    return customer!.id
  }

  async function linkUserToCustomer(customerId: string, userId: string): Promise<void> {
    await ctx.db
      .insert(schema.customerUsers)
      .values({ customerId, userId, assignedBy: TEST_USER_ID })
  }

  /** An approved operator who handles the Inbox — i.e. someone the team notification targets. */
  async function seedInboxOperator(): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id,
      email: `cs-op-${id}@mrengines.rs`,
      name: 'Inbox operator',
      isActive: true,
      accountStatus: UserAccountStatus.Approved,
    })
    const [role] = await ctx.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, SYSTEM_ROLE_OPERATOR))
      .limit(1)
    if (role === undefined) {
      throw new Error('operator role missing — system seeds must run in integration setup')
    }
    await ctx.db
      .insert(schema.userRoles)
      .values({ userId: id, roleId: role.id, assignedBy: id })
      .onConflictDoNothing()
    return id
  }

  async function notificationsForUser(userId: string) {
    return ctx.db
      .select({
        type: schema.notifications.type,
        entityType: schema.notifications.entityType,
        entityId: schema.notifications.entityId,
      })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
  }

  async function seedEngineType(): Promise<string> {
    const [engineType] = await ctx.db
      .insert(schema.engineTypes)
      .values({ code: `CS-ENG-${uniqueSuffix()}` })
      .returning({ id: schema.engineTypes.id })
    return engineType!.id
  }

  async function createSubmission(customerId: string, message: string): Promise<string> {
    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message,
    })
    submissionCleanup.push(id)
    return id
  }

  async function seedAttachmentOnSubmission(submissionId: string): Promise<string> {
    const [attachment] = await ctx.db
      .insert(schema.attachments)
      .values({
        clientSubmissionId: submissionId,
        fileName: 'photo.jpg',
        storagePath: `client-submissions/${submissionId}/photo.jpg`,
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
      })
      .returning({ id: schema.attachments.id })
    attachmentCleanup.push(attachment!.id)
    return attachment!.id
  }

  async function auditRowsFor(
    entityType: string,
    entityId: string,
  ): Promise<Array<typeof schema.auditLog.$inferSelect>> {
    return ctx.db
      .select()
      .from(schema.auditLog)
      .where(
        and(eq(schema.auditLog.entityType, entityType), eq(schema.auditLog.entityId, entityId)),
      )
  }

  describe('create', () => {
    it('notifies the Inbox team when a client reports a problem from the portal', async () => {
      const submitterId = await seedUser()
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      await linkUserToCustomer(customerId, submitterId)
      const operatorId = await seedInboxOperator()

      const { id } = await service.create(actorFor(submitterId), {
        message: 'Motor lupa nakon ugradnje',
      })

      const forOperator = await ctx.db
        .select({
          type: schema.notifications.type,
          entityType: schema.notifications.entityType,
          entityId: schema.notifications.entityId,
        })
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, operatorId))

      expect(forOperator).toEqual([
        {
          type: NotificationType.NewSubmission,
          entityType: NotificationEntityType.ClientSubmission,
          entityId: id,
        },
      ])

      // The client who reported it is never notified of their own report.
      const forSubmitter = await ctx.db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, submitterId))
      expect(forSubmitter).toHaveLength(0)
    })

    it('resolves the linked customer, writes audit, sends email and emits an event', async () => {
      const submitterId = await seedUser()
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      await linkUserToCustomer(customerId, submitterId)

      const { id } = await service.create(actorFor(submitterId), {
        message: 'Motor lupa nakon ugradnje',
      })

      const detail = await repository.findById(id)
      expect(detail).toMatchObject({
        customerId,
        message: 'Motor lupa nakon ugradnje',
        status: ClientSubmissionStatus.Pending,
      })

      const audits = await auditRowsFor('client_submission', id)
      expect(audits).toHaveLength(1)
      expect(audits[0]).toMatchObject({
        action: AuditAction.Create,
        actorUserId: submitterId,
        actorIp: '203.0.113.7',
        actorUserAgent: 'vitest-agent',
      })

      expect(events.clientSubmissionEvents).toEqual([{ type: 'client_submission_changed', id }])

      // The notification is now fire-and-settle (not awaited before the response), so it lands
      // shortly after create() returns.
      await vi.waitFor(() => expect(email.sent).toHaveLength(1))
      expect(email.sent[0]!.to).toBe(SUPPORT_EMAIL_BY_KIND[ClaimKind.Emotive])
      expect(email.sent[0]!.subject).toContain('Nova prijava')
    })

    it('uses the configured notify_email setting when present', async () => {
      const submitterId = await seedUser()
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      await linkUserToCustomer(customerId, submitterId)
      await ctx.db.insert(schema.appSettings).values({
        key: 'client_submissions.notify_email',
        value: 'ops@firma.rs',
        valueType: 'string',
      })

      await service.create(actorFor(submitterId), { message: 'Test recipient override' })

      await vi.waitFor(() => expect(email.sent).toHaveLength(1))
      expect(email.sent[0]!.to).toBe('ops@firma.rs')
    })

    it('does not fail the submission when the email send throws (best-effort)', async () => {
      const submitterId = await seedUser()
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      await linkUserToCustomer(customerId, submitterId)
      const failingService = makeService(new RecordingEmailPort(true))

      const { id } = await failingService.create(actorFor(submitterId), {
        message: 'Email will fail',
      })

      expect(await repository.findById(id)).not.toBeNull()
      expect(events.clientSubmissionEvents).toEqual([{ type: 'client_submission_changed', id }])
    })

    it('returns before a slow notification email resolves (fire-and-settle)', async () => {
      const submitterId = await seedUser()
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      await linkUserToCustomer(customerId, submitterId)

      let releaseEmail!: () => void
      const gate = new Promise<void>((resolve) => {
        releaseEmail = resolve
      })
      const gatedEmail = new GatedEmailPort(gate)
      const gatedService = makeService(gatedEmail)

      // If create() awaited the email this would deadlock — the gate is only released afterwards.
      const { id } = await gatedService.create(actorFor(submitterId), { message: 'Slow email' })

      expect(id).toBeTruthy()
      expect(gatedEmail.sent).toHaveLength(0)

      releaseEmail()
      await vi.waitFor(() => expect(gatedEmail.sent).toHaveLength(1))
    })

    it('throws ForbiddenError (no email/event) when the user is linked to no customer', async () => {
      const unlinkedUserId = await seedUser()

      await expect(
        service.create(actorFor(unlinkedUserId), { message: 'No firm' }),
      ).rejects.toBeInstanceOf(ForbiddenError)

      expect(email.sent).toHaveLength(0)
      expect(events.clientSubmissionEvents).toHaveLength(0)
    })
  })

  describe('convert', () => {
    it("replaces the team's new-submission notification with one pointing at the claim", async () => {
      const submitterId = await seedUser()
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      await linkUserToCustomer(customerId, submitterId)
      const operatorId = await seedInboxOperator()
      const engineTypeId = await seedEngineType()

      const { id } = await service.create(actorFor(submitterId), { message: 'Za konverziju' })
      submissionCleanup.push(id)
      expect((await notificationsForUser(operatorId)).map((n) => n.type)).toEqual([
        NotificationType.NewSubmission,
      ])

      const claim = await service.convert(
        actorFor(TEST_USER_ID),
        id,
        await buildClaimInput({ engineTypeId, mrNumber: `CS-CONV-${uniqueSuffix()}/26` }),
      )

      const after = await notificationsForUser(operatorId)
      expect(after).toEqual([
        {
          type: NotificationType.ClaimCreated,
          entityType: NotificationEntityType.EmotiveClaim,
          entityId: claim.id,
        },
      ])
    })

    it('creates an emotive claim, re-points attachments, marks converted and audits', async () => {
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      const engineTypeId = await seedEngineType()
      const submissionId = await createSubmission(customerId, 'Klijentov razlog reklamacije')
      const attachmentId = await seedAttachmentOnSubmission(submissionId)
      const mrNumber = `CS-OK-${uniqueSuffix()}/26`

      const claim = await service.convert(
        ACTOR,
        submissionId,
        await buildClaimInput({ engineTypeId, mrNumber }),
      )

      // Claim is created, warranty report defaults to the client's message, scoped to the firm.
      expect(claim.customerId).toBe(customerId)
      expect(claim.warrantyReport).toBe('Klijentov razlog reklamacije')
      expect(claim.mrNumber).toBe(mrNumber)

      const [attachment] = await ctx.db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, attachmentId))
      expect(attachment).toMatchObject({
        emotiveClaimId: claim.id,
        claimKind: ClaimKind.Emotive,
        clientSubmissionId: null,
      })
      // Convert re-points the attachment to the claim; it must stay live (reject soft-deletes, not convert).
      expect(attachment!.deletedAt).toBeNull()

      const submission = await repository.findById(submissionId)
      expect(submission).toMatchObject({
        status: ClientSubmissionStatus.Converted,
        linkedEmotiveClaimId: claim.id,
      })
      expect(submission!.handledAt).not.toBeNull()

      const convertAudits = await auditRowsFor('client_submission', submissionId)
      expect(convertAudits).toHaveLength(1)
      expect(convertAudits[0]!.action).toBe(AuditAction.Update)
      expect(
        (convertAudits[0]!.changes as { after: { linkedEmotiveClaimId: string } }).after,
      ).toMatchObject({ linkedEmotiveClaimId: claim.id })

      const claimAudits = await auditRowsFor('emotive_claim', claim.id)
      expect(claimAudits).toHaveLength(1)
      expect(claimAudits[0]!.action).toBe(AuditAction.Create)

      const created = events.events.filter((event) => event.type === 'created')
      expect(created).toHaveLength(1)
      expect(created[0]!.payload).toMatchObject({ kind: ClaimKind.Emotive, id: claim.id })
      expect(events.clientSubmissionEvents).toContainEqual({
        type: 'client_submission_changed',
        id: submissionId,
      })
    })

    it('is atomic: a failed claim create leaves the submission pending with its attachment', async () => {
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      const engineTypeId = await seedEngineType()
      const submissionId = await createSubmission(customerId, 'Za konverziju koja pada')
      const attachmentId = await seedAttachmentOnSubmission(submissionId)
      const takenMrNumber = `CS-DUP-${uniqueSuffix()}/26`

      // Occupy the MR number with a committed claim so the conversion's claim create fails
      // AFTER inserting its own row — proving the whole conversion transaction rolls back.
      await container.emotiveClaimsService.create(
        await buildClaimInput({ engineTypeId, mrNumber: takenMrNumber }),
        CONVERTER_ACTOR,
        CONVERTER_AUDIT_CONTEXT,
      )

      await expect(
        service.convert(
          ACTOR,
          submissionId,
          await buildClaimInput({ engineTypeId, mrNumber: takenMrNumber }),
        ),
      ).rejects.toBeInstanceOf(MrKeyConflictError)

      const submission = await repository.findById(submissionId)
      expect(submission).toMatchObject({
        status: ClientSubmissionStatus.Pending,
        linkedEmotiveClaimId: null,
      })

      const [attachment] = await ctx.db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, attachmentId))
      expect(attachment).toMatchObject({
        clientSubmissionId: submissionId,
        emotiveClaimId: null,
        claimKind: null,
      })
    })

    it('throws NotFoundError for a missing submission', async () => {
      await expect(
        service.convert(ACTOR, '00000000-0000-4000-8000-0000000000ff', await buildClaimInput()),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError for a non-pending submission', async () => {
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      const submissionId = await createSubmission(customerId, 'Vec odbijena')
      await repository.markRejected(submissionId, 'Nije garancija', TEST_USER_ID)

      await expect(
        service.convert(ACTOR, submissionId, await buildClaimInput()),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('reject', () => {
    it("replaces the team's new-submission notification with a rejected one", async () => {
      const submitterId = await seedUser()
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      await linkUserToCustomer(customerId, submitterId)
      const operatorId = await seedInboxOperator()

      // A real submission → the operator gets a `new_submission` notification.
      const { id } = await service.create(actorFor(submitterId), { message: 'Za odbijanje' })
      submissionCleanup.push(id)
      const before = await notificationsForUser(operatorId)
      expect(before.map((n) => n.type)).toEqual([NotificationType.NewSubmission])

      // A DIFFERENT operator rejects it.
      await service.reject(
        actorFor(operatorId === TEST_USER_ID ? submitterId : TEST_USER_ID),
        id,
        'Van garancije',
      )

      const after = await notificationsForUser(operatorId)
      expect(after).toEqual([
        {
          type: NotificationType.SubmissionRejected,
          entityType: NotificationEntityType.ClientSubmission,
          entityId: id,
        },
      ])
    })

    it('marks the submission rejected, audits and emits an event', async () => {
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      const submissionId = await createSubmission(customerId, 'Za odbijanje')

      await service.reject(ACTOR, submissionId, 'Van garantnog roka')

      const submission = await repository.findById(submissionId)
      expect(submission).toMatchObject({
        status: ClientSubmissionStatus.Rejected,
        rejectedReason: 'Van garantnog roka',
        linkedEmotiveClaimId: null,
      })

      const audits = await auditRowsFor('client_submission', submissionId)
      expect(audits).toHaveLength(1)
      expect(audits[0]).toMatchObject({ action: AuditAction.Update, actorUserId: TEST_USER_ID })

      expect(events.clientSubmissionEvents).toEqual([
        { type: 'client_submission_changed', id: submissionId },
      ])
    })

    it('soft-deletes the submission attachments so a storage sweep can reclaim them', async () => {
      const customerId = await seedCustomer(`Partner ${uniqueSuffix()}`)
      const submissionId = await createSubmission(customerId, 'Za odbijanje sa prilozima')
      const attachmentId = await seedAttachmentOnSubmission(submissionId)

      await service.reject(ACTOR, submissionId, 'Van garantnog roka')

      const [attachment] = await ctx.db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, attachmentId))
      // Row and storage bytes remain (soft delete only); deleted_at is set for the GC sweep.
      expect(attachment).toBeDefined()
      expect(attachment!.deletedAt).not.toBeNull()
      expect(attachment!.clientSubmissionId).toBe(submissionId)
    })
  })
})
