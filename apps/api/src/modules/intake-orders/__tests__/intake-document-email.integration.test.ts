import { schema } from '@mr/db'
import {
  AuditAction,
  IntakeArrivalMode,
  IntakeVehicleType,
  OPERATOR_PERMISSIONS,
  SERVISER_PERMISSIONS,
  UserAccountStatus,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { NotFoundError, ValidationError } from '../../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../../core/http/actor-context.js'
import type { EmailPort } from '../../../core/ports/email-port.js'
import { RecordingEmailPort } from '../../../test-helpers/recording-email-port.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { IntakeOrdersService } from '../intake-orders.service.js'
import type { IntakeOrdersActor } from '../intake-orders.types.js'

const OWNER_EMAIL = 'vlasnik@example.com'

function actorContext(userId: string): HttpActorContext {
  return { actorUserId: userId, actorIp: '203.0.113.11', actorUserAgent: 'vitest-agent' }
}

describe('the sealed sheet on its way to the owner', () => {
  let ctx: TestDbContext
  let container: Container
  let service: IntakeOrdersService
  let email: RecordingEmailPort
  let office: IntakeOrdersActor
  let floor: IntakeOrdersActor

  async function createActor(
    name: string,
    permissions: readonly string[],
  ): Promise<IntakeOrdersActor> {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id,
      email: `intake-mail-${id}@mrengines.rs`,
      name,
      isActive: true,
      accountStatus: UserAccountStatus.Approved,
    })
    return { id, permissions: [...permissions] }
  }

  /** Rebuilds the container around a different email port — a disabled one, or one that throws. */
  async function useEmailPort(port: EmailPort): Promise<void> {
    await container.pdfRenderer.dispose()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, undefined, port)
    service = container.intakeOrdersService
  }

  beforeEach(async () => {
    ctx = await createTestDbContext()
    email = new RecordingEmailPort()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, undefined, email)
    service = container.intakeOrdersService
    office = await createActor('Kancelarija', OPERATOR_PERMISSIONS)
    floor = await createActor('Serviser', SERVISER_PERMISSIONS)
  })

  afterEach(async () => {
    await container.pdfRenderer.dispose()
    await ctx.cleanup()
  })

  async function signedOrder(ownerEmail: string | null = OWNER_EMAIL): Promise<string> {
    const created = await service.create(
      {
        orderNumber: `RN-MAIL-${crypto.randomUUID().slice(0, 8)}`,
        vehicleType: IntakeVehicleType.Car,
        plate: 'BG 774-LN',
        vehicle: 'Renault Master',
        arrivalMode: IntakeArrivalMode.Driven,
        ownerName: 'Petar Petrović',
        ownerPhone: '+381 60 111 2233',
        ...(ownerEmail === null ? {} : { ownerEmail }),
      },
      actorContext(floor.id),
    )
    await service.update(
      created.id,
      { checklist: { rezervna: true } },
      floor,
      actorContext(floor.id),
    )
    await service.sign(
      created.id,
      { technicianSignature: 'M 0 0 L 10 10', ownerSignature: 'M 10 0 L 0 10', photosExpected: 0 },
      floor,
      actorContext(floor.id),
    )
    return created.id
  }

  it('sends the owner his own sheet, as a file he can open', async () => {
    const id = await signedOrder()

    await service.produceDocument(id)

    expect(email.sent).toHaveLength(1)
    const message = email.sent[0]
    expect(message?.to).toBe(OWNER_EMAIL)
    const attachment = message?.attachments?.[0]
    expect(attachment?.mimeType).toBe('application/pdf')
    expect(attachment?.fileName).toMatch(/^RN-MAIL-[0-9a-f]{8}\.pdf$/)
    // The attached bytes ARE the sealed file, not a fresh render of the same order.
    const stored = await container.storageService.read(`intake/${id}/document.pdf`)
    expect(attachment?.content).toEqual(stored)

    const document = await container.intakeOrdersRepository.findDocument(id)
    expect(document?.emailedAt).toBeInstanceOf(Date)
  })

  it('speaks both languages, because nobody knows which one this owner reads', async () => {
    await service.produceDocument(await signedOrder())

    const message = email.sent[0]
    expect(message?.subject).toContain('Radni nalog')
    expect(message?.subject).toContain('Work order')
    expect(message?.html).toContain('Poštovani')
    expect(message?.html).toContain('Dear customer')
  })

  it('sends nothing when the owner left no address, and still makes the document', async () => {
    const id = await signedOrder(null)

    await service.produceDocument(id)

    // Nikola, 13.08.: "ako klijent nema mail onda ništa, ne šalje se nego samo dobije fizičku kopiju."
    expect(email.sent).toHaveLength(0)
    const document = await container.intakeOrdersRepository.findDocument(id)
    expect(document?.storagePath).not.toBeNull()
    expect(document?.emailedAt).toBeNull()
  })

  it('sends nothing when email is not configured, and still makes the document', async () => {
    await useEmailPort({ enabled: false, send: async () => undefined })
    const id = await signedOrder()

    await service.produceDocument(id)

    const document = await container.intakeOrdersRepository.findDocument(id)
    expect(document?.storagePath).not.toBeNull()
    expect(document?.emailedAt).toBeNull()
  })

  it('keeps the document when the send fails, and sends it on the next run', async () => {
    await useEmailPort(new RecordingEmailPort(true))
    const id = await signedOrder()

    await expect(service.produceDocument(id)).rejects.toThrow('simulated send failure')

    // The seal survived the failure — it is a fact about the paper, not about the mail server.
    const afterFailure = await container.intakeOrdersRepository.findDocument(id)
    expect(afterFailure?.storagePath).not.toBeNull()
    expect(afterFailure?.emailedAt).toBeNull()

    const working = new RecordingEmailPort()
    await useEmailPort(working)
    await service.produceDocument(id)

    // Sent, and NOT re-rendered: the same object it sealed the first time.
    expect(working.sent).toHaveLength(1)
    expect(working.sent[0]?.attachments?.[0]?.content).toEqual(
      await container.storageService.read(`intake/${id}/document.pdf`),
    )
  })

  it('sends the existing file again when the office asks, and records who asked', async () => {
    const id = await signedOrder()
    await service.produceDocument(id)

    /**
     * The stored object is replaced with something unmistakable before asking for the resend.
     * Comparing against a fresh render would prove nothing: two renders seconds apart come out
     * byte-identical, because Chromium stamps the creation date to the second. What has to be shown
     * is that the bytes came out of the bucket rather than out of a browser.
     */
    const sentinel = Buffer.from('%PDF-1.4 the sealed one')
    await container.storageService.upload({
      path: `intake/${id}/document.pdf`,
      data: sentinel,
      mimeType: 'application/pdf',
    })

    await service.sendDocument(id, office, actorContext(office.id))

    expect(email.sent).toHaveLength(2)
    expect(email.sent[1]?.attachments?.[0]?.content).toEqual(sentinel)

    const audit = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id))
    expect(
      audit.filter(
        (row) =>
          row.action === AuditAction.Update &&
          (row.changes as { transition?: string } | null)?.transition === 'send_document',
      ),
    ).toHaveLength(1)
  })

  it('sends once, however many times the sealing runs', async () => {
    const id = await signedOrder()

    await service.produceDocument(id)
    await service.produceDocument(id)

    // The stamp is the guard: a retry of the background job must not put the same paper in the
    // owner's inbox twice.
    expect(email.sent).toHaveLength(1)
  })

  it('refuses to send an order that has no document yet', async () => {
    const id = await signedOrder()

    await expect(service.sendDocument(id, office, actorContext(office.id))).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  it('refuses to send to an owner who left no address', async () => {
    const id = await signedOrder(null)
    await service.produceDocument(id)

    // 422 rather than silence: the operator pressed a button and deserves to know why nothing left.
    await expect(service.sendDocument(id, office, actorContext(office.id))).rejects.toBeInstanceOf(
      ValidationError,
    )
  })
})
