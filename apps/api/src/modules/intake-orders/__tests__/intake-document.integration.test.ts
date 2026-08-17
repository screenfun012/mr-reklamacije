import { createHash } from 'node:crypto'

import { schema } from '@mr/db'
import {
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
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { IntakeOrdersService } from '../intake-orders.service.js'
import type { IntakeOrdersActor } from '../intake-orders.types.js'
import { waitForSealedDocument } from './sealing-helpers.js'

function actorContext(userId: string): HttpActorContext {
  return { actorUserId: userId, actorIp: '203.0.113.9', actorUserAgent: 'vitest-agent' }
}

describe('the sealed intake document', () => {
  let ctx: TestDbContext
  let container: Container
  let service: IntakeOrdersService
  let OFFICE: IntakeOrdersActor
  let FLOOR: IntakeOrdersActor

  /** The technician column is a real FK, so an actor in this suite is a real row. */
  async function createActor(
    name: string,
    permissions: readonly string[],
  ): Promise<IntakeOrdersActor> {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id,
      email: `intake-doc-${id}@mrengines.rs`,
      name,
      isActive: true,
      accountStatus: UserAccountStatus.Approved,
    })
    return { id, permissions: [...permissions] }
  }

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    service = container.intakeOrdersService
    OFFICE = await createActor('Kancelarija', OPERATOR_PERMISSIONS)
    FLOOR = await createActor('Serviser', SERVISER_PERMISSIONS)
  })

  afterEach(async () => {
    // The browser is shared and lives for ten idle minutes; a suite that renders must hand it back.
    await container.pdfRenderer.dispose()
    await ctx.cleanup()
  })

  /** A finished intake, signed the way the serviser leaves it: something recorded, both signatures. */
  async function signedOrder(actor?: IntakeOrdersActor): Promise<string> {
    const who = actor ?? FLOOR
    const created = await service.create(
      {
        orderNumber: `RN-DOC-${crypto.randomUUID().slice(0, 8)}`,
        vehicleType: IntakeVehicleType.Car,
        plate: 'BG 774-LN',
        vehicle: 'Renault Master',
        arrivalMode: IntakeArrivalMode.Driven,
        ownerName: 'Petar Petrović',
        ownerPhone: '+381 60 111 2233',
      },
      actorContext(who.id),
    )
    await service.update(created.id, { checklist: { rezervna: true } }, who, actorContext(who.id))
    await service.sign(
      created.id,
      {
        technicianSignature: 'M 0 0 L 10 10',
        ownerSignature: 'M 10 0 L 0 10',
        photosExpected: 0,
      },
      who,
      actorContext(who.id),
    )
    return created.id
  }

  /** Waits for the background sealing, and gives up rather than hanging the suite. */
  const waitForDocument = (
    id: string,
  ): Promise<Awaited<ReturnType<typeof container.intakeOrdersRepository.findDocument>>> =>
    waitForSealedDocument(container.intakeOrdersRepository, id, 'intake')

  it('seals the signed sheet, and the seal is of the bytes that were stored', async () => {
    const id = await signedOrder()

    await service.produceDocument(id, 'intake')

    const document = await container.intakeOrdersRepository.findDocument(id, 'intake')
    expect(document?.storagePath).toBe(`intake/${id}/document.pdf`)

    // Read back from storage rather than trusting what was uploaded: the point of the seal is to
    // answer "is the file in the bucket the file we made", so the test has to ask the bucket.
    const stored = await container.storageService.read(document?.storagePath as string)
    expect(stored.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(document?.sha256).toBe(createHash('sha256').update(stored).digest('hex'))
  })

  it('is started by the signature itself, without the signature waiting for it', async () => {
    const id = await signedOrder()

    /**
     * Polled, because the sealing deliberately does not hold the signature up: the owner is standing
     * at his car and a browser must never be between him and a signed sheet. So there is nothing to
     * await here — only the result to wait for.
     */
    const sealed = await waitForDocument(id)

    expect(sealed?.storagePath).toBe(`intake/${id}/document.pdf`)
    expect(sealed?.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is made once — a second call does not touch the file at all', async () => {
    const id = await signedOrder()

    await service.produceDocument(id, 'intake')
    const first = await container.intakeOrdersRepository.findDocument(id, 'intake')
    const storagePath = first?.storagePath as string

    /**
     * The stored object is replaced with something unmistakable, and the assertion is that it is
     * still there afterwards.
     *
     * Comparing the two seals does NOT prove this: a mutation showed both renders producing
     * byte-identical PDFs, because Chromium stamps the creation date to the second and the second
     * render landed inside the same one. The only honest question is whether anything wrote.
     */
    const sentinel = Buffer.from('%PDF-1.4 sentinel')
    await container.storageService.upload({
      path: storagePath,
      data: sentinel,
      mimeType: 'application/pdf',
    })

    await service.produceDocument(id, 'intake')

    // A re-render is a DIFFERENT file for a paper that was signed once — different bytes, different
    // seal, same signatures. Whatever is in the bucket is what the owner will be handed.
    expect(await container.storageService.read(storagePath)).toEqual(sentinel)
    const second = await container.intakeOrdersRepository.findDocument(id, 'intake')
    expect(second?.sha256).toBe(first?.sha256)
    expect(second?.storagePath).toBe(storagePath)
  })

  /**
   * The office's way back from a seal that failed.
   *
   * Until 2026-08-14 there was none: `produceDocument` had two callers, both once-only and both
   * guarded, so a Chromium crash or an unreachable bucket left an order signed, handed over and
   * permanently without its paper — and the card said "being prepared" forever. The owner's copy is
   * the point of the whole module, so it needs a door.
   */
  describe('producing it again, after a seal that failed', () => {
    it('makes the paper an order was left without', async () => {
      const id = await signedOrder()
      await service.produceDocument(id, 'intake')

      // What a failed seal leaves behind: the signatures are a fact, the columns are empty.
      await ctx.db
        .update(schema.intakeOrders)
        .set({ documentStoragePath: null, documentSha256: null, documentEmailedAt: null })
        .where(eq(schema.intakeOrders.id, id))

      await service.produceDocumentAgain(id, OFFICE, actorContext(OFFICE.id), 'intake')

      const document = await container.intakeOrdersRepository.findDocument(id, 'intake')
      expect(document?.storagePath).toBe(`intake/${id}/document.pdf`)
      const stored = await container.storageService.read(document?.storagePath as string)
      expect(stored.subarray(0, 5).toString('utf8')).toBe('%PDF-')
      expect(document?.sha256).toBe(createHash('sha256').update(stored).digest('hex'))
    })

    it('leaves a document that already exists exactly as it is', async () => {
      const id = await signedOrder()
      await service.produceDocument(id, 'intake')
      const storagePath = (await container.intakeOrdersRepository.findDocument(id, 'intake'))
        ?.storagePath as string

      // Same sentinel as above, and the same reason: two renders a second apart are byte-identical,
      // so only "did anything write" is an honest question. A retry must not become a second file
      // for a paper that was signed once.
      const sentinel = Buffer.from('%PDF-1.4 sentinel')
      await container.storageService.upload({
        path: storagePath,
        data: sentinel,
        mimeType: 'application/pdf',
      })

      await service.produceDocumentAgain(id, OFFICE, actorContext(OFFICE.id), 'intake')

      expect(await container.storageService.read(storagePath)).toEqual(sentinel)
    })

    it('answers 404 for a serviser reaching for a colleague order, never 403', async () => {
      const colleague = await createActor('Drugi serviser', SERVISER_PERMISSIONS)
      const id = await signedOrder(colleague)

      await expect(
        service.produceDocumentAgain(id, FLOOR, actorContext(FLOOR.id), 'intake'),
      ).rejects.toThrow(NotFoundError)
    })
  })

  it('refuses an unsigned order, which has no signed sheet to seal', async () => {
    const created = await service.create(
      {
        orderNumber: `RN-DOC-${crypto.randomUUID().slice(0, 8)}`,
        vehicleType: IntakeVehicleType.Car,
        plate: 'BG 775-LN',
        vehicle: 'Renault Master',
        arrivalMode: IntakeArrivalMode.Driven,
        ownerName: 'Petar Petrović',
        ownerPhone: '+381 60 111 2233',
      },
      actorContext(FLOOR.id),
    )

    await expect(service.produceDocument(created.id, 'intake')).rejects.toBeInstanceOf(
      ValidationError,
    )

    const document = await container.intakeOrdersRepository.findDocument(created.id, 'intake')
    expect(document?.storagePath).toBeNull()
  })

  it('hands the office the file under the number written on the paper', async () => {
    const id = await signedOrder()
    await service.produceDocument(id, 'intake')

    const meta = await service.getDocumentDownloadMeta(id, OFFICE, 'intake')

    expect(meta.mimeType).toBe('application/pdf')
    expect(meta.fileName).toMatch(/^RN-DOC-[0-9a-f]{8}\.pdf$/)
    const { size } = await service.openDocumentStream(meta.storagePath)
    expect(size).toBeGreaterThan(0)
  })

  it('has nothing to hand over before the document is made', async () => {
    const id = await signedOrder()

    await expect(service.getDocumentDownloadMeta(id, OFFICE, 'intake')).rejects.toBeInstanceOf(
      NotFoundError,
    )
  })

  it('answers 404 for a serviser asking about somebody else order', async () => {
    const id = await signedOrder(FLOOR)
    await service.produceDocument(id, 'intake')

    const otherServiser = await createActor('Drugi serviser', SERVISER_PERMISSIONS)

    // 404 and not 403, so a colleague's order cannot be discovered by asking for its paper.
    await expect(
      service.getDocumentDownloadMeta(id, otherServiser, 'intake'),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('carries the number of the paper into the file, slash and all', async () => {
    const created = await service.create(
      {
        orderNumber: 'RN-0950/26',
        vehicleType: IntakeVehicleType.Car,
        plate: 'BG 776-LN',
        vehicle: 'Renault Master',
        arrivalMode: IntakeArrivalMode.Driven,
        ownerName: 'Petar Petrović',
        ownerPhone: '+381 60 111 2233',
      },
      actorContext(FLOOR.id),
    )
    await service.update(
      created.id,
      { checklist: { rezervna: true } },
      FLOOR,
      actorContext(FLOOR.id),
    )
    await service.sign(
      created.id,
      { technicianSignature: 'M 0 0 L 1 1', ownerSignature: 'M 1 0 L 0 1', photosExpected: 0 },
      FLOOR,
      actorContext(FLOOR.id),
    )
    await service.produceDocument(created.id, 'intake')

    // A work order number carries a slash, and a slash is a path separator in every download the
    // browser will save.
    expect((await service.getDocumentDownloadMeta(created.id, OFFICE, 'intake')).fileName).toBe(
      'RN-0950-26.pdf',
    )
  })
})
