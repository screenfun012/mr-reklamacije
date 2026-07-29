import { schema } from '@mr/db'
import {
  IntakeArrivalMode,
  IntakeDamageType,
  IntakeNumberCheckStatus,
  IntakeOrderStatus,
  IntakeVehicleType,
  ResourceChangedKey,
  SERVISER_PERMISSIONS,
  OPERATOR_PERMISSIONS,
  UserAccountStatus,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AttachmentUploadFileInput } from '../../../core/attachments/attachment-upload-pipeline.js'
import type { Container } from '../../../core/container.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../../core/http/actor-context.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { IntakeOrdersService } from '../intake-orders.service.js'
import type { IntakeOrdersActor } from '../intake-orders.types.js'
import type { IntakeOrderCreateInput } from '../intake-orders.validators.js'

const OFFICE_PERMISSIONS = [...OPERATOR_PERMISSIONS]
const FLOOR_PERMISSIONS = [...SERVISER_PERMISSIONS]

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

  /** A finished intake: created, filled in, both signatures. */
  async function signedOrder(
    actor: IntakeOrdersActor,
    overrides: Partial<IntakeOrderCreateInput> = {},
  ): Promise<string> {
    const created = await service.create(createInput(overrides), actorContext(actor.id))
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

  /** A finished intake signed with a specific `photosExpected`, for the amendment-shift tests. */
  async function signedOrderExpecting(
    actor: IntakeOrdersActor,
    photosExpected: number,
  ): Promise<string> {
    const created = await service.create(createInput(), actorContext(actor.id))
    await service.sign(
      created.id,
      { technicianSignature: 'M 0 0 L 10 10', ownerSignature: 'M 5 5 L 20 20', photosExpected },
      actor,
      actorContext(actor.id),
    )
    return created.id
  }

  beforeEach(async () => {
    ctx = await createTestDbContext()
    events = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, events)
    service = container.intakeOrdersService
  })

  afterEach(async () => {
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

  describe('unfinished intakes', () => {
    it("keeps a draft out of the office's list but in its own serviser's", async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      const officeList = await service.list(office, {
        unfinished: false,
        page: 1,
        pageSize: 25,
      })
      const floorList = await service.list(floor, { unfinished: false, page: 1, pageSize: 25 })

      expect(officeList.items.map((item) => item.id)).not.toContain(draft.id)
      expect(floorList.items.map((item) => item.id)).toContain(draft.id)
      expect(floorList.items.find((item) => item.id === draft.id)?.signedAt).toBeNull()
      expect(floorList.items.find((item) => item.id === draft.id)?.draftStep).toBe(1)
    })

    it('shows the office its drafts when it explicitly asks for them', async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      const found = await service.list(office, { unfinished: true, page: 1, pageSize: 25 })
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

      const list = await service.list(floor, { unfinished: false, page: 1, pageSize: 25 })
      expect(list.items.map((item) => item.id)).toEqual(
        expect.arrayContaining([first.id, second.id]),
      )
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

  describe('the freeze after signing', () => {
    it('lets anyone with update still edit services and materials', async () => {
      const floor = await floorActor()
      const orderId = await signedOrder(floor)

      const updated = await service.update(
        orderId,
        { services: ['Zamena ulja'], materials: ['Filter'] },
        floor,
        actorContext(floor.id),
      )

      expect(updated.services).toEqual(['Zamena ulja'])
      expect(updated.amendedAt).toBeNull()
    })

    it('refuses a serviser correcting the intake condition, even though he holds update', async () => {
      const floor = await floorActor()
      const orderId = await signedOrder(floor)

      await expect(
        service.update(orderId, { fuelLevel: 2 }, floor, actorContext(floor.id)),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('stamps the order when the office corrects the condition, so the print can admit it', async () => {
      const floor = await floorActor()
      const office = await officeActor('Ana')
      const orderId = await signedOrder(floor)

      const amended = await service.update(
        orderId,
        {
          fuelLevel: 6,
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
        office,
        actorContext(office.id),
      )

      expect(amended.amendedAt).not.toBeNull()
      expect(amended.amendedByName).toBe('Ana')
      expect(amended.fuelLevel).toBe(6)
    })

    it('refuses a field the signed paper carries, even for the office', async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const orderId = await signedOrder(floor)

      await expect(
        service.update(orderId, { ownerName: 'Neko Drugi' }, office, actorContext(office.id)),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('leaves an unsigned intake fully editable without any amend stamp', async () => {
      const floor = await floorActor()
      const draft = await service.create(createInput(), actorContext(floor.id))

      const updated = await service.update(
        draft.id,
        { ownerName: 'Ispravljeno Ime', fuelLevel: 7, draftStep: 2 },
        floor,
        actorContext(floor.id),
      )

      expect(updated.ownerName).toBe('Ispravljeno Ime')
      expect(updated.amendedAt).toBeNull()
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
    it('walks the ladder one notch at a time and stops at the end', async () => {
      const floor = await floorActor()
      const orderId = await signedOrder(floor)

      expect((await service.advance(orderId, floor, actorContext(floor.id))).status).toBe(
        IntakeOrderStatus.InProgress,
      )
      expect((await service.advance(orderId, floor, actorContext(floor.id))).status).toBe(
        IntakeOrderStatus.Done,
      )
      expect((await service.advance(orderId, floor, actorContext(floor.id))).status).toBe(
        IntakeOrderStatus.PickedUp,
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

    it('refuses to let a serviser remove a signed order', async () => {
      const floor = await floorActor()
      const orderId = await signedOrder(floor)

      await expect(service.delete(orderId, floor, actorContext(floor.id))).rejects.toBeInstanceOf(
        ForbiddenError,
      )
    })

    it('soft-deletes a signed order for the office — evidence leaves the list, not the database', async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const orderId = await signedOrder(floor)

      await service.delete(orderId, office, actorContext(office.id))

      const [row] = await ctx.db
        .select({ deletedAt: schema.intakeOrders.deletedAt })
        .from(schema.intakeOrders)
        .where(eq(schema.intakeOrders.id, orderId))
      expect(row?.deletedAt).not.toBeNull()
      await expect(service.findById(orderId, office)).rejects.toBeInstanceOf(NotFoundError)
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

    it('freezes photos at the signature — a serviser can no longer remove one', async () => {
      const floor = await floorActor()
      const created = await service.create(createInput(), actorContext(floor.id))
      const photo = await service.uploadPhoto(
        created.id,
        photoInput(),
        null,
        floor,
        actorContext(floor.id),
      )
      await service.sign(
        created.id,
        { technicianSignature: 'M0 0', ownerSignature: 'M0 0', photosExpected: 1 },
        floor,
        actorContext(floor.id),
      )

      await expect(
        service.deletePhoto(created.id, photo.id, floor, actorContext(floor.id)),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it("accepts a photo that lands AFTER signing from the order's own serviser, unstamped", async () => {
      const floor = await floorActor()
      const orderId = await signedOrder(floor)

      // The tablet was still uploading in the background; the photo was taken before the
      // signature, so it must not read as an amendment.
      const photo = await service.uploadPhoto(
        orderId,
        photoInput(),
        null,
        floor,
        actorContext(floor.id),
      )

      const after = await service.findById(orderId, floor)
      expect(after.photos.map((p) => p.id)).toContain(photo.id)
      expect(after.amendedAt).toBeNull()
    })

    it('treats the office adding a photo after signing as an amendment, and stamps it', async () => {
      const floor = await floorActor()
      const office = await officeActor('Ana')
      const orderId = await signedOrder(floor)

      await service.uploadPhoto(orderId, photoInput(), null, office, actorContext(office.id))

      const after = await service.findById(orderId, office)
      expect(after.amendedAt).not.toBeNull()
      expect(after.amendedByName).toBe('Ana')
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
      const orderId = await signedOrder(theirs)
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

    it('keeps the missing-photo count meaning one thing when the office amends', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const id = await signedOrderExpecting(serviser, 3) // signed with photosExpected: 3, 0 arrived

      await service.uploadPhoto(id, photoInput(), null, office, actorContext(office.id))

      const afterAdd = await service.findById(id, office)
      expect(afterAdd.photosPending).toBe(3)

      const photo = afterAdd.photos[0]
      expect(photo).toBeDefined()
      await service.deletePhoto(id, photo!.id, office, actorContext(office.id))

      const afterRemove = await service.findById(id, office)
      expect(afterRemove.photosPending).toBe(3)
    })

    it('never drives photos_expected below zero, whatever the office removes', async () => {
      const serviser = await floorActor()
      const office = await officeActor()
      const id = await signedOrderExpecting(serviser, 0)

      await service.uploadPhoto(id, photoInput(), null, office, actorContext(office.id))
      const detail = await service.findById(id, office)
      const photo = detail.photos[0]
      expect(photo).toBeDefined()

      // expected is 1 after the add; removing takes it to 0, and a second removal must not
      // try to take it to -1 and hit intake_orders_photos_expected_check.
      await expect(
        service.deletePhoto(id, photo!.id, office, actorContext(office.id)),
      ).resolves.toBeUndefined()
      const after = await service.findById(id, office)
      expect(after.photosPending).toBe(0)
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

    it('audits an amendment with its own transition, so the history can name it', async () => {
      const floor = await floorActor()
      const office = await officeActor()
      const orderId = await signedOrder(floor)

      await service.update(orderId, { fuelLevel: 1 }, office, actorContext(office.id))

      const rows = await ctx.db
        .select({ changes: schema.auditLog.changes })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, orderId))

      const transitions = rows.map((row) => (row.changes as { transition?: string })?.transition)
      expect(transitions).toContain('amend_after_signing')
    })
  })
})
