import { schema } from '@mr/db'
import {
  IntakeArrivalMode,
  IntakeOrderStatus,
  IntakeVehicleType,
  OPERATOR_PERMISSIONS,
  SERVISER_PERMISSIONS,
  UserAccountStatus,
  type Permission,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppVariables } from '../../../app.js'
import type { Container } from '../../../core/container.js'
import { ConflictError, NotFoundError } from '../../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../../core/http/actor-context.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import { ensureTestUser } from '../../../test-helpers/fixtures.js'
import { RecordingEmailPort } from '../../../test-helpers/recording-email-port.js'
import { buildTestContainer, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { registerIntakeOrdersRoutes } from '../index.js'
import type { IntakeOrdersService } from '../intake-orders.service.js'
import type { IntakeOrdersActor } from '../intake-orders.types.js'

const OWNER_EMAIL = 'vlasnik@example.com'

const SIGNATURES = {
  technicianSignature: 'M 0 0 L 30 30',
  ownerSignature: 'M 30 0 L 0 30',
}

function actorContext(userId: string): HttpActorContext {
  return { actorUserId: userId, actorIp: '203.0.113.14', actorUserAgent: 'vitest-agent' }
}

describe('handing the vehicle back', () => {
  let ctx: TestDbContext
  let container: Container
  let service: IntakeOrdersService
  let email: RecordingEmailPort
  let office: IntakeOrdersActor
  let floor: IntakeOrdersActor

  /** The two technician columns are real FKs, so an actor in this suite is a real row. */
  async function createActor(
    name: string,
    permissions: readonly string[],
  ): Promise<IntakeOrdersActor> {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id,
      email: `intake-handover-${id}@mrengines.rs`,
      name,
      isActive: true,
      accountStatus: UserAccountStatus.Approved,
    })
    return { id, permissions: [...permissions] }
  }

  beforeEach(async () => {
    ctx = await createTestDbContext()
    email = new RecordingEmailPort()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, undefined, email)
    service = container.intakeOrdersService
    // The HTTP tests audit, and `actor_user_id` is a real foreign key: without this the route
    // answers 500 for a reason that has nothing to do with the route.
    await ensureTestUser(ctx.db)
    office = await createActor('Kancelarija', OPERATOR_PERMISSIONS)
    floor = await createActor('Serviser', SERVISER_PERMISSIONS)
  })

  afterEach(async () => {
    // The browser is shared and lives for ten idle minutes; a suite that seals must hand it back.
    await container.pdfRenderer.dispose()
    await ctx.cleanup()
  })

  /** An order taken in and signed, which is the only state a handover can start from. */
  async function signedOrder(ownerEmail: string | null = OWNER_EMAIL): Promise<string> {
    const created = await service.create(
      {
        orderNumber: `RN-HAND-${crypto.randomUUID().slice(0, 8)}`,
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
      { ...SIGNATURES, photosExpected: 0 },
      floor,
      actorContext(floor.id),
    )
    return created.id
  }

  /** An order still being filled in — nothing has been received, so there is nothing to give back. */
  async function draftOrder(): Promise<string> {
    const created = await service.create(
      {
        orderNumber: `RN-HAND-${crypto.randomUUID().slice(0, 8)}`,
        vehicleType: IntakeVehicleType.Car,
        plate: 'BG 775-LN',
        vehicle: 'Renault Master',
        arrivalMode: IntakeArrivalMode.Driven,
        ownerName: 'Petar Petrović',
        ownerPhone: '+381 60 111 2233',
      },
      actorContext(floor.id),
    )
    return created.id
  }

  it('records the signatures, the moment, and WHO stood there — and moves the order to preuzeto', async () => {
    const id = await signedOrder()

    // Handed over by the OFFICE, not by the serviser who took the car in: whoever is standing there
    // when the owner arrives is who signs, and that is the caller.
    const handed = await service.handOver(id, SIGNATURES, office, actorContext(office.id))

    expect(handed.status).toBe(IntakeOrderStatus.PickedUp)
    expect(handed.handoverSignedAt).not.toBeNull()
    expect(handed.handoverTechnicianSignature).toBe(SIGNATURES.technicianSignature)
    expect(handed.handoverOwnerSignature).toBe(SIGNATURES.ownerSignature)
    // The paper has to be able to name him. Taken from the caller, never from the request body.
    expect(handed.handoverTechnicianName).toBe('Kancelarija')

    const [row] = await ctx.db
      .select({ technicianId: schema.intakeOrders.handoverTechnicianId })
      .from(schema.intakeOrders)
      .where(eq(schema.intakeOrders.id, id))
    expect(row?.technicianId).toBe(office.id)
  })

  it('seals the handover sheet and sends it to the owner', async () => {
    const id = await signedOrder()

    await service.handOver(id, SIGNATURES, office, actorContext(office.id))
    await service.produceDocument(id, 'handover')

    const document = await container.intakeOrdersRepository.findDocument(id, 'handover')
    expect(document?.storagePath).toBe(`intake/${id}/handover.pdf`)
    const stored = await container.storageService.read(document?.storagePath as string)
    expect(stored.subarray(0, 5).toString('utf8')).toBe('%PDF-')

    // The handover sheet, not a second copy of the work order: its own subject, its own file name.
    const message = email.sent.at(-1)
    expect(message?.to).toBe(OWNER_EMAIL)
    expect(message?.subject).toContain('Primopredaja')
    expect(message?.subject).toContain('handover')
    expect(message?.attachments?.[0]?.fileName).toMatch(/^RN-HAND-[0-9a-f]{8}-primopredaja\.pdf$/)
    expect(message?.attachments?.[0]?.content).toEqual(stored)

    // The intake's own document is untouched by any of this — two papers, two keys, two stamps.
    expect((await container.intakeOrdersRepository.findDocument(id, 'intake'))?.storagePath).toBe(
      `intake/${id}/document.pdf`,
    )
  })

  it('is sealed once — a second run does not touch the file at all', async () => {
    const id = await signedOrder()
    await service.handOver(id, SIGNATURES, office, actorContext(office.id))
    await service.produceDocument(id, 'handover')

    /**
     * The stored object is replaced with something unmistakable, and the assertion is that it is
     * still there afterwards. Comparing two seals proves nothing: Chromium stamps the creation date
     * to the second, so two renders inside one second come out byte-identical.
     */
    const path = `intake/${id}/handover.pdf`
    const sentinel = Buffer.from('%PDF-1.4 the sealed handover')
    await container.storageService.upload({
      path,
      data: sentinel,
      mimeType: 'application/pdf',
    })

    await service.produceDocument(id, 'handover')

    expect(await container.storageService.read(path)).toEqual(sentinel)
  })

  it('refuses a second handover — the vehicle only leaves once', async () => {
    const id = await signedOrder()
    await service.handOver(id, SIGNATURES, office, actorContext(office.id))

    await expect(
      service.handOver(id, SIGNATURES, office, actorContext(office.id)),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('refuses to hand over an intake that was never signed — there is nothing to give back', async () => {
    const id = await draftOrder()

    await expect(
      service.handOver(id, SIGNATURES, office, actorContext(office.id)),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it("answers 404 for a serviser reaching for a colleague's order, never 403", async () => {
    // The order belongs to `floor`. 404 and not 403 is the house rule — a serviser must not learn
    // that a colleague's order exists — and it is asserted HERE, on top of `loadVisible`'s own
    // tests, because this is the endpoint that mails a document out of the company.
    const id = await signedOrder()
    const otherServiser = await createActor('Drugi serviser', SERVISER_PERMISSIONS)

    await expect(
      service.handOver(id, SIGNATURES, otherServiser, actorContext(otherServiser.id)),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      service.handOverWithoutSignature(id, otherServiser, actorContext(otherServiser.id)),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  /**
   * The permission split only exists if this rung is closed: a serviser holds `advance`, so while
   * the ladder walked all the way to `preuzeto` he could release a vehicle with no handover and no
   * superior — and the two endpoints below would be a formality anybody could route around.
   */
  it('refuses to walk the last rung — a vehicle leaves through the handover or not at all', async () => {
    const id = await signedOrder()
    await service.advance(id, floor, actorContext(floor.id))
    const done = await service.advance(id, floor, actorContext(floor.id))
    expect(done.status).toBe(IntakeOrderStatus.Done)

    await expect(service.advance(id, floor, actorContext(floor.id))).rejects.toBeInstanceOf(
      ConflictError,
    )
    // Still reachable by the two that own the transition — a closed rung, not a closed road.
    const handed = await service.handOver(id, SIGNATURES, office, actorContext(office.id))
    expect(handed.status).toBe(IntakeOrderStatus.PickedUp)
  })

  it('lets the office record a pickup with no signature, and makes no document for it', async () => {
    const id = await signedOrder()

    const handed = await service.handOverWithoutSignature(id, office, actorContext(office.id))

    expect(handed.status).toBe(IntakeOrderStatus.PickedUp)
    // The empty column IS the record that nobody signed — there is no sheet to seal.
    expect(handed.handoverSignedAt).toBeNull()
    expect(handed.handoverDocumentReady).toBe(false)
    expect(email.sent).toHaveLength(0)

    const audit = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id))
    expect(
      audit.filter(
        (entry) =>
          (entry.changes as { transition?: string } | null)?.transition === 'handover_skipped',
      ),
    ).toHaveLength(1)
  })

  describe('as the browser reaches them', () => {
    function app(user: ReturnType<typeof testUser> | null): Hono<{ Variables: AppVariables }> {
      const instance = new Hono<{ Variables: AppVariables }>()
      registerGlobalErrorHandler(instance, container.logger)
      instance.use('*', async (c, next) => {
        c.set('user', user)
        c.set('session', null)
        await next()
      })
      registerIntakeOrdersRoutes(instance, container)
      return instance
    }

    it('hands the vehicle back through the route, and answers with the order', async () => {
      const id = await signedOrder()

      const response = await app(testUser([...OPERATOR_PERMISSIONS], office.id)).request(
        `/api/intake-orders/${id}/handover`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(SIGNATURES),
        },
      )

      expect(response.status).toBe(200)
      expect(((await response.json()) as { status: string }).status).toBe(
        IntakeOrderStatus.PickedUp,
      )
    })

    it('keeps the unsigned pickup behind change_status, which a serviser does not hold', async () => {
      const id = await signedOrder()

      const response = await app(
        testUser([...SERVISER_PERMISSIONS], floor.id, ['serviser']),
      ).request(`/api/intake-orders/${id}/handover/skip`, { method: 'POST' })

      expect(response.status).toBe(403)
    })

    it('turns away a caller who may not see intake orders at all', async () => {
      const id = await signedOrder()

      const response = await app(testUser(['claim_reports.view'] as Permission[])).request(
        `/api/intake-orders/${id}/handover`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(SIGNATURES),
        },
      )

      expect(response.status).toBe(403)
    })
  })
})
