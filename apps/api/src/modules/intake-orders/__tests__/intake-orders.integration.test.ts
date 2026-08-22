import { schema } from '@mr/db'
import {
  ADMIN_PERMISSIONS,
  IntakeArrivalMode,
  IntakeDamageType,
  IntakeNumberCheckStatus,
  IntakeOrderStatus,
  IntakeOwnerType,
  IntakeOrderUpdateInputSchema,
  IntakeVehicleType,
  ResourceChangedKey,
  SERVISER_PERMISSIONS,
  OPERATOR_PERMISSIONS,
  UserAccountStatus,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AttachmentUploadFileInput } from '../../../core/attachments/attachment-upload-pipeline.js'
import type { Container } from '../../../core/container.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../../core/http/actor-context.js'
import type { IntakeChecklistItemsService } from '../../intake-checklist-items/intake-checklist-items.service.js'
import type { IntakeChecklistItemListItem } from '../../intake-checklist-items/intake-checklist-items.validators.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { IntakeOrdersService } from '../intake-orders.service.js'
import type { IntakeOrdersActor } from '../intake-orders.types.js'
import type { IntakeOrderCreateInput, IntakeOrderUpdateInput } from '../intake-orders.validators.js'

const OFFICE_PERMISSIONS = [...OPERATOR_PERMISSIONS]
const FLOOR_PERMISSIONS = [...SERVISER_PERMISSIONS]

/** A real PDF header: the pipeline reads magic bytes, never the declared type or the name. */
const PDF_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25])

function actorContext(userId: string): HttpActorContext {
  return { actorUserId: userId, actorIp: '203.0.113.7', actorUserAgent: 'vitest-agent' }
}

/**
 * Order numbers come off a printed pad, so tests mint their own unique ones — the unique
 * index is partial on live rows and the suite shares a database with every other suite.
 */
function uniqueNumber(label: string): string {
  return `RN-${label}-${crypto.randomUUID().slice(0, 8)}`
}

function createInput(overrides: Partial<IntakeOrderCreateInput> = {}): IntakeOrderCreateInput {
  return {
    orderNumber: uniqueNumber('base'),
    vehicleType: IntakeVehicleType.Car,
    plate: 'BG 774-LN',
    vehicle: 'Renault Master',
    arrivalMode: IntakeArrivalMode.Driven,
    ownerName: 'Petar Petrović',
    ownerPhone: '+381 60 111 2233',
    ...overrides,
  }
}

/** A 1x1 JPEG — real magic bytes, because the pipeline checks them. */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDL/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmAA=',
  'base64',
)

function photoInput(name = 'IMG_01.jpg'): AttachmentUploadFileInput {
  return { fileName: name, data: JPEG, caption: null }
}

describe('Intake orders integration', () => {
  let ctx: TestDbContext
  let container: Container
  let events: RecordingEventBus
  let service: IntakeOrdersService
  /** The admin's side of the catalog — the checklist guard reads what this writes. */
  let checklistService: IntakeChecklistItemsService

  async function createUser(name: string): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id,
      email: `intake-${id}@mrengines.rs`,
      name,
      isActive: true,
      accountStatus: UserAccountStatus.Approved,
    })
    return id
  }

  async function floorActor(name = 'Serviser'): Promise<IntakeOrdersActor> {
    return { id: await createUser(name), permissions: FLOOR_PERMISSIONS }
  }

  async function officeActor(name = 'Kancelarija'): Promise<IntakeOrdersActor> {
    return { id: await createUser(name), permissions: OFFICE_PERMISSIONS }
  }

  /** The serviser's package holds it: he is the one who makes the quote and brings it back. */
  function quoteActor(actor: IntakeOrdersActor): IntakeOrdersActor {
    return { ...actor, permissions: [...actor.permissions, 'intake_orders.attach_quote'] }
  }

  /** Archiving is in no standard package — only an admin, or an account the office was given it. */
  async function archiveActor(name = 'Arhivar'): Promise<IntakeOrdersActor> {
    return {
      id: await createUser(name),
      permissions: [...OFFICE_PERMISSIONS, 'intake_orders.archive'],
    }
  }

  /**
   * A finished intake: created, filled in, both signatures.
   *
   * The checklist row is not decoration — signing refuses an order that recorded nothing about the
   * vehicle's condition, and one answered item is what the serviser would have tapped standing at
   * the car.
   */
  async function signedOrder(
    actor: IntakeOrdersActor,
    overrides: Partial<IntakeOrderCreateInput> = {},
  ): Promise<string> {
    const created = await service.create(createInput(overrides), actorContext(actor.id))
    await service.update(
      created.id,
      { checklist: { rezervna: true } },
      actor,
      actorContext(actor.id),
    )
    await service.sign(
      created.id,
      {
        technicianSignature: 'M 0 0 L 10 10',
        ownerSignature: 'M 5 5 L 20 20',
        photosExpected: 0,
      },
      actor,
      actorContext(actor.id),
    )
    return created.id
  }

  /** A finished intake signed with a specific `photosExpected`, for the late-arrival tests. */
  async function signedOrderExpecting(
    actor: IntakeOrdersActor,
    photosExpected: number,
  ): Promise<string> {
    const created = await service.create(createInput(), actorContext(actor.id))
    await service.update(
      created.id,
      { checklist: { rezervna: true } },
      actor,
      actorContext(actor.id),
    )
    await service.sign(
      created.id,
      { technicianSignature: 'M 0 0 L 10 10', ownerSignature: 'M 5 5 L 20 20', photosExpected },
      actor,
      actorContext(actor.id),
    )
    return created.id
  }

  /** Every transition this order's audit rows carry, in no particular order. */
  async function transitionsOf(orderId: string): Promise<(string | undefined)[]> {
    const rows = await ctx.db
      .select({ changes: schema.auditLog.changes })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, orderId))
    return rows.map((row) => (row.changes as { transition?: string })?.transition)
  }

  beforeEach(async () => {
    ctx = await createTestDbContext()
    events = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, events)
    service = container.intakeOrdersService
    checklistService = container.intakeChecklistItemsService
  })

  afterEach(async () => {
    // Signing seals the document in the background, and that runs a browser. Left alone it holds a
    // few hundred MB for ten minutes per container this suite builds — and this suite builds one per
    // test.
    await container.pdfRenderer.dispose()
    await ctx.cleanup()
  })

  describe('row-level scope', () => {
    it("returns 404 — never 403 — for a colleague's order, so its existence never leaks", async () => {
      const mine = await floorActor('Pera')
      const theirs = await floorActor('Mika')
      const orderId = await signedOrder(theirs)

      await expect(service.findById(orderId, mine)).rejects.toBeInstanceOf(NotFoundError)
      await expect(service.findById(orderId, mine)).rejects.not.toBeInstanceOf(ForbiddenError)
    })

    it('lets the office see an order it did not create', async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const orderId = await signedOrder(floor)

      const order = await service.findById(orderId, office)
      expect(order.id).toBe(orderId)
    })

    it('refuses a caller holding neither view nor view_own', async () => {
      const stranger: IntakeOrdersActor = { id: await createUser('Viewer'), permissions: [] }
      await expect(service.summary(stranger)).rejects.toBeInstanceOf(ForbiddenError)
    })
  })

  describe('list views', () => {
    it("keeps a draft out of the office's list but in its own serviser's", async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      const officeList = await service.list(office, {
        view: 'active',
        page: 1,
        pageSize: 25,
      })
      const floorList = await service.list(floor, { view: 'active', page: 1, pageSize: 25 })

      expect(officeList.items.map((item) => item.id)).not.toContain(draft.id)
      expect(floorList.items.map((item) => item.id)).toContain(draft.id)
      expect(floorList.items.find((item) => item.id === draft.id)?.signedAt).toBeNull()
      expect(floorList.items.find((item) => item.id === draft.id)?.draftStep).toBe(1)
    })

    it('shows the office its drafts when it explicitly asks for them', async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      const found = await service.list(office, { view: 'unfinished', page: 1, pageSize: 25 })
      expect(found.items.map((item) => item.id)).toContain(draft.id)
    })

    it('counts only signed orders in the KPI cards', async () => {
      const floor = await floorActor()
      await service.create(createInput(), actorContext(floor.id))
      await signedOrder(floor)

      const summary = await service.summary(floor)
      expect(summary.primljeno).toBe(1)
    })

    it('allows several unfinished intakes for one serviser', async () => {
      const floor = await floorActor()
      const first = await service.create(createInput(), actorContext(floor.id))
      const second = await service.create(createInput(), actorContext(floor.id))

      const list = await service.list(floor, { view: 'active', page: 1, pageSize: 25 })
      expect(list.items.map((item) => item.id)).toEqual(
        expect.arrayContaining([first.id, second.id]),
      )
    })

    it('takes an archived order out of the list and out of the KPI cards', async () => {
      const office = await officeActor()
      const archiver = await archiveActor()
      const id = await signedOrder(await floorActor())

      const before = await service.summary(office)
      await service.setArchived(id, true, archiver, actorContext(archiver.id))

      const list = await service.list(office, { view: 'active', page: 1, pageSize: 25 })
      const archived = await service.list(office, { view: 'archived', page: 1, pageSize: 25 })
      const after = await service.summary(office)

      expect(list.items.map((item) => item.id)).not.toContain(id)
      expect(archived.items.map((item) => item.id)).toContain(id)
      // ⚙ leave the exclusion out of `summary` and this stays equal: the row leaves the list while
      // the number above it does not, and the screen contradicts itself in one viewport.
      expect(after.primljeno).toBe(before.primljeno - 1)
    })

    it("hides an archived order from its own serviser's list too", async () => {
      // ⚙ the archived predicate must sit OUTSIDE `scopeCondition`, which returns early for a
      // serviser — inside it, his own archived orders keep showing.
      const floor = await floorActor()
      const archiver = await archiveActor()
      const id = await signedOrder(floor)

      await service.setArchived(id, true, archiver, actorContext(archiver.id))

      const list = await service.list(floor, { view: 'active', page: 1, pageSize: 25 })
      expect(list.items.map((item) => item.id)).not.toContain(id)
    })

    it('brings an archived order back, and writes both moves to the history', async () => {
      const office = await officeActor()
      const archiver = await archiveActor()
      const id = await signedOrder(await floorActor())

      await service.setArchived(id, true, archiver, actorContext(archiver.id))
      const restored = await service.setArchived(id, false, archiver, actorContext(archiver.id))
      expect(restored.archivedAt).toBeNull()

      const list = await service.list(office, { view: 'active', page: 1, pageSize: 25 })
      expect(list.items.map((item) => item.id)).toContain(id)

      const rows = await ctx.db
        .select({ changes: schema.auditLog.changes })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, id))
      const transitions = rows
        .map((row) => (row.changes as { transition?: string } | null)?.transition)
        .filter((transition) => transition === 'archive' || transition === 'unarchive')
      expect(transitions).toEqual(['archive', 'unarchive'])
    })

    it('refuses to archive an unfinished intake — that one is discarded', async () => {
      const floor = await floorActor()
      const archiver = await archiveActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      await expect(
        service.setArchived(draft.id, true, archiver, actorContext(archiver.id)),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('keeps the quote out of the photos, and out of the count that gates the wizard', async () => {
      // ⚙ drop the purpose filter in `listPhotos` or in the list's photo counter and this goes red:
      // an intake photo is recognised by nothing but its order id, so the quote would land in the
      // grid — and `photoCount` feeds `photosPending`, which is a GATE, not a decoration.
      const floor = await floorActor()
      const office = await officeActor()
      const id = await signedOrder(floor)

      await service.attachQuote(
        id,
        { fileName: 'ponuda.pdf', data: PDF_BYTES },
        quoteActor(floor),
        actorContext(floor.id),
      )

      const detail = await service.findById(id, office)
      expect(detail.quote?.fileName).toBe('ponuda.pdf')
      expect(detail.photos).toHaveLength(0)

      const list = await service.list(office, { view: 'active', page: 1, pageSize: 25 })
      expect(list.items.find((item) => item.id === id)?.photoCount).toBe(0)
    })

    it('replaces the quote instead of collecting them', async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const id = await signedOrder(floor)

      await service.attachQuote(
        id,
        { fileName: 'prva.pdf', data: PDF_BYTES },
        quoteActor(floor),
        actorContext(floor.id),
      )
      const after = await service.attachQuote(
        id,
        { fileName: 'druga.pdf', data: PDF_BYTES },
        quoteActor(floor),
        actorContext(floor.id),
      )

      expect(after.quote?.fileName).toBe('druga.pdf')
      const detail = await service.findById(id, office)
      expect(detail.quote?.fileName).toBe('druga.pdf')
    })

    it('refuses a quote on an unfinished intake — there is no work to quote yet', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      await expect(
        service.attachQuote(
          draft.id,
          { fileName: 'ponuda.pdf', data: PDF_BYTES },
          quoteActor(floor),
          actorContext(floor.id),
        ),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('still gives a serviser his own drafts under the default view', async () => {
      const serviser = await floorActor()
      await service.create(createInput(), actorContext(serviser.id))

      const list = await service.list(serviser, { view: 'active', page: 1, pageSize: 25 })
      expect(list.items).toHaveLength(1)
      expect(list.items[0]?.signedAt).toBeNull()
    })
  })

  describe('order number', () => {
    it('reports a free number as free', async () => {
      const floor = await floorActor()
      const result = await service.checkNumber(uniqueNumber('free'), floor)
      expect(result.status).toBe(IntakeNumberCheckStatus.Free)
    })

    it('offers the actor their own unfinished intake to resume, with the step reached', async () => {
      const floor = await floorActor()
      const orderNumber = uniqueNumber('mine')
      const draft = await service.create(createInput({ orderNumber }), actorContext(floor.id))
      await service.update(draft.id, { draftStep: 3 }, floor, actorContext(floor.id))

      const result = await service.checkNumber(orderNumber, floor)
      expect(result.status).toBe(IntakeNumberCheckStatus.TakenDraftMine)
      expect(result.orderId).toBe(draft.id)
      expect(result.draftStep).toBe(3)
    })

    it('names the colleague holding an unfinished number but never returns its id', async () => {
      const mine = await floorActor('Pera')
      const theirs = await floorActor('Mika')
      const orderNumber = uniqueNumber('theirs')
      await service.create(createInput({ orderNumber }), actorContext(theirs.id))

      const result = await service.checkNumber(orderNumber, mine)
      expect(result.status).toBe(IntakeNumberCheckStatus.TakenDraftOther)
      expect(result.takenByName).toBe('Mika')
      expect(result.orderId).toBeNull()
      expect(result.plate).toBeNull()
    })

    it('links a signed order the caller may open', async () => {
      const floor = await floorActor()
      const orderNumber = uniqueNumber('signed')
      const orderId = await signedOrder(floor, { orderNumber })

      const result = await service.checkNumber(orderNumber, floor)
      expect(result.status).toBe(IntakeNumberCheckStatus.TakenOrder)
      expect(result.orderId).toBe(orderId)
    })

    it('ignores case and surrounding whitespace when deciding a number is taken', async () => {
      const floor = await floorActor()
      const orderNumber = uniqueNumber('CASE')
      await service.create(createInput({ orderNumber }), actorContext(floor.id))

      const result = await service.checkNumber(`  ${orderNumber.toLowerCase()} `, floor)
      expect(result.status).toBe(IntakeNumberCheckStatus.TakenDraftMine)
    })

    it('refuses to create a second order on a live number', async () => {
      const floor = await floorActor()
      const orderNumber = uniqueNumber('dup')
      await service.create(createInput({ orderNumber }), actorContext(floor.id))

      await expect(
        service.create(createInput({ orderNumber }), actorContext(floor.id)),
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  describe('the signature freezes the record', () => {
    it('refuses every frozen field on a signed order, office and floor alike', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const id = await signedOrder(serviser)
      const stored = await service.findById(id, office)

      const frozen: IntakeOrderUpdateInput[] = [
        { plate: 'BG-999-XX' },
        { vehicleType: IntakeVehicleType.Van },
        { ownerName: 'Neko Drugi' },
        { ownerPhone: '+381 60 000 0000' },
        { ownerRemarks: 'dopisano posle' },
        { fuelLevel: 1 },
        { checklist: { ...stored.checklist, rezervna: false } },
        { damages: [] },
        { equipmentNote: 'dopisano posle' },
      ]

      // An admin holds every permission there is, so he is the one actor who could still have a
      // way in. The freeze has no permission branch at all — this pins that it never grows one (㉕).
      const admin: IntakeOrdersActor = {
        id: await createUser('Admin'),
        permissions: [...ADMIN_PERMISSIONS],
      }

      for (const patch of frozen) {
        for (const actor of [office, serviser, admin]) {
          await expect(
            service.update(id, patch, actor, actorContext(actor.id)),
          ).rejects.toBeInstanceOf(ValidationError)
        }
      }
    })

    it('refuses a frozen field even when the value equals what is stored', async () => {
      const office = await officeActor()
      const id = await signedOrder(await floorActor())
      const before = await service.findById(id, office)

      // Refused on the field's NAME. Pruning a key because it happens to match would make
      // "send it again with the same value" a way past the freeze.
      await expect(
        service.update(id, { ownerName: before.ownerName }, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('still accepts services and materials, lets one be removed, and says so in Istorija', async () => {
      const office = await officeActor()
      const id = await signedOrder(await floorActor())

      const withParts = await service.update(
        id,
        { services: ['zamena ulja'], materials: ['filter', 'ulje 5W30'] },
        office,
        actorContext(office.id),
      )
      expect(withParts.materials).toEqual(['filter', 'ulje 5W30'])

      const withoutOne = await service.update(
        id,
        { materials: ['filter'] },
        office,
        actorContext(office.id),
      )
      expect(withoutOne.materials).toEqual(['filter'])
      expect(await transitionsOf(id)).toContain('spec_updated')
    })

    /*
     * The third member of `FREE_AFTER_SIGNING`, and the only one this task ADDED — so it needs its
     * own line. Read off the COLUMN as well as the response, now that both read models carry the
     * field too. The transition alone would not be enough — it is derived from the patch, so it
     * would survive a repository that writes nothing.
     */
    it('accepts a contact number on a signed order and names it in Istorija', async () => {
      const office = await officeActor()
      const id = await signedOrder(await floorActor())
      const before = await service.findById(id, office)

      const updated = await service.update(
        id,
        { contactPhone: '+381 64 123 4567' },
        office,
        actorContext(office.id),
      )

      const [row] = await ctx.db
        .select({ contactPhone: schema.intakeOrders.contactPhone })
        .from(schema.intakeOrders)
        .where(eq(schema.intakeOrders.id, id))
      expect(row?.contactPhone).toBe('+381 64 123 4567')
      expect(updated.contactPhone).toBe('+381 64 123 4567')
      // The whole reason this field is allowed to exist: the signed number is untouched.
      expect(updated.ownerPhone).toBe(before.ownerPhone)
      expect(await transitionsOf(id)).toContain('contact_added')
    })

    it('clears the contact number when sent null', async () => {
      const office = await officeActor()
      const id = await signedOrder(await floorActor())
      await service.update(id, { contactPhone: '+381 64 1' }, office, actorContext(office.id))

      const cleared = await service.update(
        id,
        { contactPhone: null },
        office,
        actorContext(office.id),
      )
      expect(cleared.contactPhone).toBeNull()
    })

    it('refuses a contact number on a DRAFT — there the real field is simply corrected', async () => {
      const serviser = await floorActor()
      const draft = await service.create(createInput(), actorContext(serviser.id))

      await expect(
        service.update(
          draft.id,
          { contactPhone: '+381 64 1' },
          serviser,
          actorContext(serviser.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('refuses to remove a signed order, and still discards a draft', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const signed = await signedOrder(serviser)

      await expect(service.delete(signed, office, actorContext(office.id))).rejects.toBeInstanceOf(
        ValidationError,
      )

      const draft = await service.create(createInput(), actorContext(serviser.id))
      await service.delete(draft.id, serviser, actorContext(serviser.id))
      await expect(service.findById(draft.id, office)).rejects.toBeInstanceOf(NotFoundError)
    })

    it('accepts a late photo from the order own serviser, only up to photos_expected', async () => {
      const serviser = await floorActor()
      const id = await signedOrderExpecting(serviser, 1)

      const photo = await service.uploadPhoto(
        id,
        photoInput(),
        null,
        serviser,
        actorContext(serviser.id),
      )
      expect(photo.id).toBeDefined()

      // The record no longer admits anything is missing, so the door is shut.
      await expect(
        service.uploadPhoto(id, photoInput(), null, serviser, actorContext(serviser.id)),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('refuses a photo on a signed order from anyone but its own serviser', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const id = await signedOrderExpecting(serviser, 2)

      await expect(
        service.uploadPhoto(id, photoInput(), null, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('refuses removing a photo from a signed order, for everyone', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const id = await signedOrderExpecting(serviser, 1)
      const photo = await service.uploadPhoto(
        id,
        photoInput(),
        null,
        serviser,
        actorContext(serviser.id),
      )

      for (const actor of [serviser, office]) {
        await expect(
          service.deletePhoto(id, photo.id, actor, actorContext(actor.id)),
        ).rejects.toBeInstanceOf(ValidationError)
      }
    })
  })

  describe('an unfinished intake belongs to its serviser', () => {
    it('refuses the office on every mutating path while the intake is unsigned', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      await expect(
        service.update(created.id, { fuelLevel: 4 }, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ForbiddenError)
      await expect(
        service.sign(
          created.id,
          { technicianSignature: 'M 0 0 L 1 1', ownerSignature: 'M 0 0 L 1 1', photosExpected: 0 },
          office,
          actorContext(office.id),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError)
      await expect(
        service.uploadPhoto(created.id, photoInput(), null, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('still lets the office throw an abandoned draft away', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      await expect(
        service.delete(created.id, office, actorContext(office.id)),
      ).resolves.toBeUndefined()
    })

    /*
     * The route gate is an OR, and the `all` scope hands any `view` holder every serviser's
     * draft — so the only thing standing between "sees everything, may edit, may not delete"
     * and a colleague's permanently destroyed intake is this guard. No seeded role pairs
     * `view` with `update` and withholds `delete`, but a custom role built in admin can.
     *
     * The surviving row is asserted, not just the rejection: a guard placed one line too late
     * would still throw, and the draft would still be gone — hard, with nothing to undo it with.
     */
    it("refuses a full-list editor without delete throwing away another serviser's draft", async () => {
      const editorNoDelete: IntakeOrdersActor = {
        id: await createUser('View Plus Update'),
        permissions: ['intake_orders.view', 'intake_orders.update'],
      }
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      await expect(
        service.delete(created.id, editorNoDelete, actorContext(editorNoDelete.id)),
      ).rejects.toBeInstanceOf(ForbiddenError)

      const rows = await ctx.db
        .select({ id: schema.intakeOrders.id })
        .from(schema.intakeOrders)
        .where(eq(schema.intakeOrders.id, created.id))
      expect(rows).toHaveLength(1)
    })

    it('lets that same editor throw away a draft he started himself', async () => {
      const editorNoDelete: IntakeOrdersActor = {
        id: await createUser('View Plus Update Own'),
        permissions: ['intake_orders.view', 'intake_orders.update'],
      }
      const created = await service.create(createInput(), actorContext(editorNoDelete.id))

      await expect(
        service.delete(created.id, editorNoDelete, actorContext(editorNoDelete.id)),
      ).resolves.toBeUndefined()
    })

    it('refuses the office deleting a photo from an unsigned draft too', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const created = await service.create(createInput(), actorContext(serviser.id))
      const photo = await service.uploadPhoto(
        created.id,
        photoInput(),
        null,
        serviser,
        actorContext(serviser.id),
      )

      await expect(
        service.deletePhoto(created.id, photo.id, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('leaves the owning serviser free on his own draft', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      const updated = await service.update(
        created.id,
        { fuelLevel: 4 },
        serviser,
        actorContext(serviser.id),
      )
      expect(updated.fuelLevel).toBe(4)
    })
  })

  /**
   * The wire accepts any well-formed code and the CATALOG decides which ones exist (spec ⑭). Until
   * this landed the eight keys were hardcoded in the schema, so an item the shop added in admin was
   * either 422'd out of the wizard or silently stripped from the order.
   */
  describe('the checklist is judged against the catalog', () => {
    /** The catalog's own list read, the way the admin screen does it. */
    async function catalogItem(code: string): Promise<IntakeChecklistItemListItem> {
      const { items } = await checklistService.list({
        activeOnly: false,
        includeDeleted: false,
        limit: 50,
      })
      const found = items.find((item) => item.code === code)
      if (found === undefined) {
        throw new Error(`seed missing: ${code}`)
      }
      return found
    }

    it('accepts a checklist key the admin added to the catalog', async () => {
      const serviser = await floorActor()
      const admin = await createUser('Admin')
      await checklistService.create(
        { code: 'patosnici', nameSr: 'Gumeni patosnici', nameEn: 'Rubber mats', sortOrder: 90 },
        actorContext(admin),
      )

      const created = await service.create(createInput(), actorContext(serviser.id))
      const updated = await service.update(
        created.id,
        { checklist: { rezervna: true, patosnici: false } },
        serviser,
        actorContext(serviser.id),
      )

      expect(updated.checklist['patosnici']).toBe(false)
    })

    it('refuses a checklist key that is not in the catalog', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      // Otherwise any caller writes whatever it likes into a document that is evidence (spec ⑭).
      await expect(
        service.update(
          created.id,
          { checklist: { izmisljeno: true } },
          serviser,
          actorContext(serviser.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('still accepts a code whose catalog item was deactivated', async () => {
      const serviser = await floorActor()
      const admin = await createUser('Admin')
      const chains = await catalogItem('lanci')
      await checklistService.update(chains.id, { isActive: false }, actorContext(admin))

      const created = await service.create(createInput(), actorContext(serviser.id))
      const updated = await service.update(
        created.id,
        { checklist: { lanci: true } },
        serviser,
        actorContext(serviser.id),
      )

      // Deactivated hides it from the PICKER; a correction to an order that already holds it must
      // still land (plan D3).
      expect(updated.checklist['lanci']).toBe(true)
    })

    it('still accepts a code whose catalog item was removed', async () => {
      const serviser = await floorActor()
      const admin = await createUser('Admin')
      const chains = await catalogItem('lanci')
      await checklistService.softDelete(chains.id, actorContext(admin))

      const created = await service.create(createInput(), actorContext(serviser.id))
      const updated = await service.update(
        created.id,
        { checklist: { lanci: false } },
        serviser,
        actorContext(serviser.id),
      )

      expect(updated.checklist['lanci']).toBe(false)
    })

    /**
     * The read is CONDITIONAL, and that is a requirement rather than a detail: the wizard patches on
     * every step, so an unconditional read would put a query on each of them for nothing.
     *
     * Counted on the real port instead of faking the service's four collaborators around one `if`:
     * `spyOn` wraps the concrete repository and still calls through, so this mocks nothing — which
     * the house rule for integration tests requires anyway.
     */
    it('reads the catalog only when the patch carries a checklist', async () => {
      const serviser = await floorActor()
      const reads = vi.spyOn(container.intakeChecklistItemsRepository, 'listKnownCodes')
      const created = await service.create(createInput(), actorContext(serviser.id))

      await service.update(created.id, { fuelLevel: 4 }, serviser, actorContext(serviser.id))
      expect(reads).not.toHaveBeenCalled()

      await service.update(
        created.id,
        { checklist: { rezervna: true } },
        serviser,
        actorContext(serviser.id),
      )
      expect(reads).toHaveBeenCalledTimes(1)
    })

    /** An error listing two hundred codes is one nobody reads; a bare count would not say which. */
    it('names the first five unknown codes and counts the rest', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))
      const checklist = Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [`izmisljeno_${index}`, true]),
      )

      const thrown = await service
        .update(created.id, { checklist }, serviser, actorContext(serviser.id))
        .catch((error: unknown) => error)

      if (!(thrown instanceof ValidationError)) {
        throw new Error('expected the checklist guard to refuse')
      }
      expect(thrown.message).toBe(
        'Unknown checklist item: izmisljeno_0, izmisljeno_1, izmisljeno_2, izmisljeno_3, izmisljeno_4 (+2 more)',
      )
    })

    /**
     * A fresh database with no `db:seed` has an empty catalog, and the wizard then sends `{}` on the
     * way out of step 1. Before this task that was a 422 with nothing on the screen to fix — the
     * intake could not be filled in at all (plan D5).
     */
    it('accepts an empty checklist and records exactly that, without asking the catalog', async () => {
      const serviser = await floorActor()
      const reads = vi.spyOn(container.intakeChecklistItemsRepository, 'listKnownCodes')
      const created = await service.create(createInput(), actorContext(serviser.id))
      expect(created.checklist).toEqual({})

      const updated = await service.update(
        created.id,
        { checklist: {}, draftStep: 2 },
        serviser,
        actorContext(serviser.id),
      )

      expect(updated.checklist).toEqual({})
      expect(updated.draftStep).toBe(2)
      // An empty map HAS no codes to check, and this is the patch every step-2 save of an
      // empty-catalog shop sends — it must not cost a query either.
      expect(reads).not.toHaveBeenCalled()
    })
  })

  describe('damage zones', () => {
    it('derives the zone from the coordinates and ignores whatever the client sent', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      const updated = await service.update(
        draft.id,
        {
          damages: [
            // A client claiming the bonnet for a spot that is the roof must not win: the zone is
            // printed on the document the customer signs.
            { id: 'd1', type: IntakeDamageType.Scratch, x: 170, y: 300, zone: 'hauba' },
          ],
        },
        floor,
        actorContext(floor.id),
      )

      expect(updated.damages[0]?.zone).toBe('krov')
    })

    it('re-zones existing markers when the vehicle type changes', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))
      const asCar = await service.update(
        draft.id,
        { damages: [{ id: 'd1', type: IntakeDamageType.Dent, x: 170, y: 90, zone: 'x' }] },
        floor,
        actorContext(floor.id),
      )
      expect(asCar.damages[0]?.zone).toBe('gepek / poklopac')

      const asVan = await service.update(
        draft.id,
        { vehicleType: IntakeVehicleType.Van },
        floor,
        actorContext(floor.id),
      )

      // One spot, two vehicles: a car's boot lid is a kombi's cargo roof. A kombi must never
      // print "gepek" — it does not have one.
      expect(asVan.damages[0]?.zone).toBe('krov teretnog dela')
    })
  })

  describe('status', () => {
    /**
     * It stops at Gotovo, one rung short of the end: `preuzeto` is the handover's transition and
     * nobody else's (see `advance` in the service). A serviser holds `advance`, so a ladder that ran
     * to the top would hand every vehicle back without signatures and without a superior.
     */
    it('walks the ladder one notch at a time and stops before the handover', async () => {
      const floor = await floorActor()
      const orderId = await signedOrder(floor)

      expect((await service.advance(orderId, floor, actorContext(floor.id))).status).toBe(
        IntakeOrderStatus.InProgress,
      )
      expect((await service.advance(orderId, floor, actorContext(floor.id))).status).toBe(
        IntakeOrderStatus.Done,
      )
      await expect(service.advance(orderId, floor, actorContext(floor.id))).rejects.toBeInstanceOf(
        ConflictError,
      )
    })

    it('lets the office set any status to undo a mis-tap', async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const orderId = await signedOrder(floor)
      await service.advance(orderId, floor, actorContext(floor.id))

      const corrected = await service.changeStatus(
        orderId,
        { status: IntakeOrderStatus.Received },
        office,
        actorContext(office.id),
      )
      expect(corrected.status).toBe(IntakeOrderStatus.Received)
    })

    it('refuses to move the status of an intake that was never signed', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      await expect(service.advance(draft.id, floor, actorContext(floor.id))).rejects.toBeInstanceOf(
        ValidationError,
      )
    })
  })

  describe('removal', () => {
    it('really deletes an abandoned draft and releases its number', async () => {
      const floor = await floorActor()
      const orderNumber = uniqueNumber('abandon')
      const draft = await service.create(createInput({ orderNumber }), actorContext(floor.id))

      await service.delete(draft.id, floor, actorContext(floor.id))

      const rows = await ctx.db
        .select({ id: schema.intakeOrders.id })
        .from(schema.intakeOrders)
        .where(eq(schema.intakeOrders.id, draft.id))
      expect(rows).toHaveLength(0)

      const check = await service.checkNumber(orderNumber, floor)
      expect(check.status).toBe(IntakeNumberCheckStatus.Free)
    })
  })

  describe('plate lookup', () => {
    it('offers the previous owner and vehicle for a plate that has been in before', async () => {
      const floor = await floorActor()
      await signedOrder(floor, { plate: 'NS 123-AB', ownerName: 'Mika Mikić', vin: 'VF1234567' })

      const result = await service.lookupByPlate('ns123ab')
      expect(result.match?.ownerName).toBe('Mika Mikić')
      expect(result.match?.vin).toBe('VF1234567')
    })

    it('offers nothing for a plate the shop has never seen', async () => {
      const result = await service.lookupByPlate(`ZZ${crypto.randomUUID().slice(0, 6)}`)
      expect(result.match).toBeNull()
    })

    it('does not offer an unfinished intake as a previous visit', async () => {
      const floor = await floorActor()
      const plate = `KG ${crypto.randomUUID().slice(0, 3)}-XX`
      await service.create(createInput({ plate }), actorContext(floor.id))

      const result = await service.lookupByPlate(plate)
      expect(result.match).toBeNull()
    })
  })

  describe('history', () => {
    it('tells the story of the order — create, sign, advance, each correctly projected', async () => {
      const floor = await floorActor()
      const orderId = await signedOrder(floor)
      await service.advance(orderId, floor, actorContext(floor.id))

      const history = await service.listHistory(orderId, floor)

      // create → sign → advance — all three land inside this ONE test's single wrapping
      // transaction (test-helpers/test-db.ts), and Postgres's `now()` is frozen for the
      // whole transaction, so the three audit rows get a byte-identical `created_at`.
      // Which tied row `ORDER BY created_at DESC` puts first is then an unspecified
      // implementation detail, not a guarantee — it silently flipped when an unrelated
      // WHERE-clause addition changed the query plan. So this asserts on what each event
      // recorded, not on their tied position. Two genuinely separate HTTP requests in
      // production get distinct timestamps, where newest-first is unambiguous.
      expect(history).toHaveLength(3)
      const advance = history.find((row) => row.transition === 'advance')
      const sign = history.find((row) => row.transition === 'sign')
      const create = history.find((row) => row.action === 'create')
      expect(advance?.fromStatus).toBe('primljeno')
      expect(advance?.toStatus).toBe('u_radu')
      expect(sign).toBeDefined()
      expect(create).toBeDefined()
      expect(history.every((row) => row.actorName !== null)).toBe(true)
    })

    /**
     * The history must not become a way around row-level scope: it is the same order, so it is the
     * same 404 the detail gives — never a 403, which would confirm the order exists.
     */
    it("404s for a colleague's order rather than telling them it exists", async () => {
      const mine = await floorActor('Pera')
      const theirs = await floorActor('Mika')
      const orderId = await signedOrder(theirs)

      await expect(service.listHistory(orderId, mine)).rejects.toBeInstanceOf(NotFoundError)
    })

    /**
     * The audit rows carry the actor's IP, their user agent and a whole before/after object with
     * the signature paths in it. None of that may reach the tab.
     */
    it('projects the row and never hands back the raw audit payload', async () => {
      const floor = await floorActor()
      const orderId = await signedOrder(floor)

      const history = await service.listHistory(orderId, floor)
      const keys = Object.keys(history[0] ?? {}).sort()

      expect(keys).toEqual([
        'action',
        'actorName',
        'at',
        'fromStatus',
        'id',
        'toStatus',
        'transition',
      ])
      expect(JSON.stringify(history)).not.toContain('M 0 0 L 10 10')
    })

    it('keeps a post-signing services edit — the one edit a signed order still allows', async () => {
      const actor = await floorActor()
      const id = await signedOrder(actor)

      await service.update(id, { services: ['Zamena filtera'] }, actor, actorContext(actor.id))

      const history = await service.listHistory(id, actor)
      const specRows = history.filter((row) => row.transition === 'spec_updated')
      expect(specRows).toHaveLength(1)
    })

    it('leaves the wizard out of the story — filling an intake in is not a change to it', async () => {
      const actor = await floorActor()
      const created = await service.create(createInput(), actorContext(actor.id))
      await service.update(created.id, { draftStep: 2 }, actor, actorContext(actor.id))
      await service.update(created.id, { fuelLevel: 5 }, actor, actorContext(actor.id))

      const history = await service.listHistory(created.id, actor)
      expect(history).toHaveLength(1)
      expect(history[0]?.action).toBe('create')
    })
  })

  describe('photos', () => {
    it('lets a serviser delete his own photo while he is still filling the intake in', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))
      const photo = await service.uploadPhoto(
        draft.id,
        photoInput(),
        null,
        floor,
        actorContext(floor.id),
      )

      await service.deletePhoto(draft.id, photo.id, floor, actorContext(floor.id))

      const after = await service.findById(draft.id, floor)
      expect(after.photos).toHaveLength(0)
    })

    it('keeps a photo but drops its number when its damage is removed from the map', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))
      const damage = {
        id: 'd1',
        type: IntakeDamageType.Scratch,
        x: 100,
        y: 200,
        zone: 'prednja leva strana',
      }
      const other = { ...damage, id: 'd2', x: 240, y: 300 }
      await service.update(draft.id, { damages: [damage, other] }, floor, actorContext(floor.id))

      const bound = await service.uploadPhoto(
        draft.id,
        photoInput(),
        'd1',
        floor,
        actorContext(floor.id),
      )
      const kept = await service.uploadPhoto(
        draft.id,
        photoInput('b.jpg'),
        'd2',
        floor,
        actorContext(floor.id),
      )

      await service.update(draft.id, { damages: [other] }, floor, actorContext(floor.id))

      const after = await service.findById(draft.id, floor)
      // Deleting a marker must never destroy evidence — the photo survives, unnumbered.
      expect(after.photos).toHaveLength(2)
      expect(after.photos.find((photo) => photo.id === bound.id)?.damageId).toBeNull()
      // A photo whose damage is still on the map keeps its number.
      expect(after.photos.find((photo) => photo.id === kept.id)?.damageId).toBe('d2')
    })

    it('unbinds every photo when the last damage is removed', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))
      await service.update(
        draft.id,
        {
          damages: [
            {
              id: 'd1',
              type: IntakeDamageType.Scratch,
              x: 100,
              y: 200,
              zone: 'prednja leva strana',
            },
          ],
        },
        floor,
        actorContext(floor.id),
      )
      const photo = await service.uploadPhoto(
        draft.id,
        photoInput(),
        'd1',
        floor,
        actorContext(floor.id),
      )

      await service.update(draft.id, { damages: [] }, floor, actorContext(floor.id))

      const after = await service.findById(draft.id, floor)
      expect(after.photos).toHaveLength(1)
      expect(after.photos.find((row) => row.id === photo.id)?.damageId).toBeNull()
    })

    it('refuses a damageId that is not on this order', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      await expect(
        service.uploadPhoto(draft.id, photoInput(), 'nema-me', floor, actorContext(floor.id)),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it("404s when a serviser reaches for a colleague's photo instead of leaking that it exists", async () => {
      const mine = await floorActor('Pera')
      const theirs = await floorActor('Mika')
      // Expecting one photo, so his own late arrival is accepted — the subject here is the 404.
      const orderId = await signedOrderExpecting(theirs, 1)
      const photo = await service.uploadPhoto(
        orderId,
        photoInput(),
        null,
        theirs,
        actorContext(theirs.id),
      )

      await expect(
        service.getPhotoDownloadMeta(orderId, photo.id, 'original', mine),
      ).rejects.toBeInstanceOf(NotFoundError)
      await expect(
        service.deletePhoto(orderId, photo.id, mine, actorContext(mine.id)),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('falls back to the full photo when no thumbnail was generated, rather than 404ing', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))
      const photo = await service.uploadPhoto(
        draft.id,
        photoInput(),
        null,
        floor,
        actorContext(floor.id),
      )

      const original = await service.getPhotoDownloadMeta(draft.id, photo.id, 'original', floor)
      const thumb = await service.getPhotoDownloadMeta(draft.id, photo.id, 'thumbnail', floor)

      // Content-addressed, so a browser revalidates instead of re-downloading over the hall's WiFi.
      expect(original.etag).not.toBeNull()
      // An image too small to be worth a thumbnail has none; the grid must still get a picture.
      expect(thumb.storagePath).toBe(original.storagePath)
      expect(thumb.etag).toBe(original.etag)
    })
  })

  /**
   * The owner signs the printed sheet standing at the car, and that sheet is the only evidence if he
   * later says a jack was in the boot. The wizard holds this line too, but a tablet reloads and
   * `?resume=` is a URL — the paper must not depend on which browser produced it.
   */
  describe('an order cannot be signed with nothing recorded about its condition', () => {
    const SIGNATURES = {
      technicianSignature: 'M 0 0 L 10 10',
      ownerSignature: 'M 5 5 L 20 20',
      photosExpected: 0,
    }

    it('refuses the signature while the checklist and the note are both empty', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      await expect(
        service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id)),
      ).rejects.toBeInstanceOf(ValidationError)

      // Refused means refused: the order is still a draft the serviser can go back and finish.
      const after = await service.findById(created.id, serviser)
      expect(after.signedAt).toBeNull()
    })

    it('accepts the signature once a single item is answered', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))
      // NE is a statement too — "there was no spare in this car" is exactly what the paper is for.
      await service.update(
        created.id,
        { checklist: { rezervna: false } },
        serviser,
        actorContext(serviser.id),
      )

      const signed = await service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id))

      expect(signed.signedAt).not.toBeNull()
    })

    it('accepts the signature on the equipment note alone', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))
      await service.update(
        created.id,
        { equipmentNote: 'Gepek pun alata' },
        serviser,
        actorContext(serviser.id),
      )

      const signed = await service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id))

      expect(signed.signedAt).not.toBeNull()
    })

    /**
     * Nikola's decision, and the one this guard could most easily get wrong: if the office turns
     * every item off, the car is still in the yard and the serviser cannot fix a catalog — so the
     * signature must go through. Reading the catalog with `listKnownCodes` instead (which keeps
     * retired codes on purpose) would make a fully retired shop look full and lock the floor, and
     * nothing else in this suite can tell the two reads apart.
     */
    it('signs without anything recorded once the office has retired every item', async () => {
      const serviser = await floorActor()
      const admin = await createUser('Admin')
      const { items } = await checklistService.list({
        activeOnly: true,
        includeDeleted: false,
        limit: 100,
      })
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) {
        await checklistService.update(item.id, { isActive: false }, actorContext(admin))
      }

      const created = await service.create(createInput(), actorContext(serviser.id))
      const signed = await service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id))

      expect(signed.signedAt).not.toBeNull()
    })

    it('counts only what a serviser can actually tick', async () => {
      const admin = await createUser('Admin')
      const before = await container.intakeChecklistItemsRepository.countActiveItems()

      const added = await checklistService.create(
        { code: 'privremena', nameSr: 'Privremena', nameEn: 'Temporary', sortOrder: 900 },
        actorContext(admin),
      )
      expect(await container.intakeChecklistItemsRepository.countActiveItems()).toBe(before + 1)

      // Retired and removed items still answer `listKnownCodes` on purpose — they must NOT answer
      // here, or a fully retired catalog would read as full and lock the shop floor over a mistake
      // nobody on the floor can fix.
      await checklistService.update(added.id, { isActive: false }, actorContext(admin))
      expect(await container.intakeChecklistItemsRepository.countActiveItems()).toBe(before)

      await checklistService.softDelete(added.id, actorContext(admin))
      expect(await container.intakeChecklistItemsRepository.countActiveItems()).toBe(before)
    })
  })

  /**
   * The two lists a serviser fills in himself, because the shop's own lists do not offer what he is
   * looking at — scratched wheels, a missing cover, rubber mats.
   */
  describe('the rows a serviser writes in himself', () => {
    const SIGNATURES = {
      technicianSignature: 'M 0 0 L 10 10',
      ownerSignature: 'M 5 5 L 20 20',
      photosExpected: 0,
    }

    it('starts both lists empty rather than null, so nothing downstream has to guard', async () => {
      const serviser = await floorActor()

      const created = await service.create(createInput(), actorContext(serviser.id))

      expect(created.extraChecklist).toEqual([])
      expect(created.extraDamages).toEqual([])
    })

    it('stores and returns both written-in lists', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      const updated = await service.update(
        created.id,
        {
          extraChecklist: [{ name: 'Gumeni patosnici', value: true }],
          extraDamages: ['felne izgrebane', 'nedostaje poklopac'],
        },
        serviser,
        actorContext(serviser.id),
      )

      expect(updated.extraChecklist).toEqual([{ name: 'Gumeni patosnici', value: true }])
      expect(updated.extraDamages).toEqual(['felne izgrebane', 'nedostaje poklopac'])
    })

    it('refuses both lists once the order is signed, the office included', async () => {
      // Part H freezes by field NAME, and these two are frozen by not being on FREE_AFTER_SIGNING —
      // an absence. This test exists because an absence is exactly what a later edit undoes without
      // noticing it has undone anything.
      const serviser = await floorActor()
      const office = await officeActor()
      const orderId = await signedOrder(serviser)

      await expect(
        service.update(
          orderId,
          { extraDamages: ['felne izgrebane'] },
          serviser,
          actorContext(serviser.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
      await expect(
        service.update(
          orderId,
          { extraChecklist: [{ name: 'Patosnici', value: true }] },
          office,
          actorContext(office.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('lets a written-in row alone satisfy the signing rule', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))
      await service.update(
        created.id,
        { extraChecklist: [{ name: 'Gumeni patosnici', value: false }] },
        serviser,
        actorContext(serviser.id),
      )

      const signed = await service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id))

      expect(signed.signedAt).not.toBeNull()
    })

    it('does not let a written-in row nobody answered satisfy it', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))
      await service.update(
        created.id,
        { extraChecklist: [{ name: 'Gumeni patosnici', value: null }] },
        serviser,
        actorContext(serviser.id),
      )

      await expect(
        service.sign(created.id, SIGNATURES, serviser, actorContext(serviser.id)),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  /**
   * Who handed the vehicle over, and where his copy goes. The identifier is one column whose meaning
   * the type gives it; the email is optional, and empty means the owner leaves with paper only.
   */
  describe('the owner identity', () => {
    it('defaults to a private person, so an order taken before this existed reads honestly', async () => {
      const serviser = await floorActor()

      const created = await service.create(createInput(), actorContext(serviser.id))

      expect(created.ownerType).toBe(IntakeOwnerType.Person)
      expect(created.ownerIdNumber).toBeNull()
      expect(created.ownerEmail).toBeNull()
    })

    it('stores the identifier and the email', async () => {
      const serviser = await floorActor()
      const created = await service.create(createInput(), actorContext(serviser.id))

      const updated = await service.update(
        created.id,
        {
          ownerType: IntakeOwnerType.Company,
          ownerIdNumber: '101234567',
          ownerEmail: 'firma@primer.rs',
        },
        serviser,
        actorContext(serviser.id),
      )

      expect(updated.ownerType).toBe(IntakeOwnerType.Company)
      expect(updated.ownerIdNumber).toBe('101234567')
      expect(updated.ownerEmail).toBe('firma@primer.rs')
    })

    it('refuses an address that is not an email, so nothing is sent into the void', () => {
      // Asserted against the SCHEMA, not through the service: the parse happens at the HTTP
      // boundary, so a service-level call would be handed an already-valid object and prove nothing.
      expect(IntakeOrderUpdateInputSchema.safeParse({ ownerEmail: 'nije-mejl' }).success).toBe(
        false,
      )
      expect(
        IntakeOrderUpdateInputSchema.safeParse({ ownerEmail: 'vlasnik@primer.rs' }).success,
      ).toBe(true)
    })

    it('freezes all three once the order is signed', async () => {
      // Frozen by an ABSENCE — they are simply not on FREE_AFTER_SIGNING — which is exactly what a
      // later edit undoes without noticing it has undone anything.
      const serviser = await floorActor()
      const orderId = await signedOrder(serviser)

      await expect(
        service.update(
          orderId,
          { ownerIdNumber: '123456789' },
          serviser,
          actorContext(serviser.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
      await expect(
        service.update(
          orderId,
          { ownerEmail: 'novi@primer.rs' },
          serviser,
          actorContext(serviser.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
      await expect(
        service.update(
          orderId,
          { ownerType: IntakeOwnerType.Company },
          serviser,
          actorContext(serviser.id),
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('realtime + audit', () => {
    it('signals the list to refresh on every change, carrying no row data', async () => {
      const floor = await floorActor()
      events.resourceEvents.length = 0
      await service.create(createInput(), actorContext(floor.id))

      expect(events.resourceEvents).toContainEqual(
        expect.objectContaining({ resource: ResourceChangedKey.IntakeOrders }),
      )
    })
  })
})
