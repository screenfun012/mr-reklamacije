import { schema } from '@mr/db'
import {
  IntakeArrivalMode,
  IntakeVehicleType,
  OPERATOR_PERMISSIONS,
  SERVISER_PERMISSIONS,
  UserAccountStatus,
  type Permission,
} from '@mr/shared'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppVariables } from '../../../app.js'
import type { Container } from '../../../core/container.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import type { HttpActorContext } from '../../../core/http/actor-context.js'
import { ensureTestUser } from '../../../test-helpers/fixtures.js'
import { RecordingEmailPort } from '../../../test-helpers/recording-email-port.js'
import { buildTestContainer, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { registerIntakeOrdersRoutes } from '../index.js'

/**
 * The two document routes as the browser reaches them: middleware, permissions and status codes.
 *
 * The service's own suites cover what the routes CALL. What only this layer can answer is whether
 * they are wired at all, and whether the permission in front of each one is the one intended — a
 * route registered without its gate passes every service test ever written.
 */
function createIntakeTestApp(
  container: Container,
  user: ReturnType<typeof testUser> | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerIntakeOrdersRoutes(app, container)

  return app
}

describe('the document routes', () => {
  let ctx: TestDbContext
  let container: Container
  let email: RecordingEmailPort
  let technicianId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    email = new RecordingEmailPort()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, undefined, email)
    // The resend writes an audit row, and `actor_user_id` is a real foreign key: without this the
    // route answers 500 for a reason that has nothing to do with the route.
    await ensureTestUser(ctx.db)
    technicianId = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id: technicianId,
      email: `intake-http-${technicianId}@mrengines.rs`,
      name: 'Serviser',
      isActive: true,
      accountStatus: UserAccountStatus.Approved,
    })
  })

  afterEach(async () => {
    await container.pdfRenderer.dispose()
    await ctx.cleanup()
  })

  function actorContext(): HttpActorContext {
    return { actorUserId: technicianId, actorIp: '203.0.113.12', actorUserAgent: 'vitest-agent' }
  }

  /** A signed order with its document already sealed, which is the only state these routes serve. */
  async function orderWithDocument(
    ownerEmail: string | null = 'vlasnik@example.com',
  ): Promise<string> {
    const service = container.intakeOrdersService
    const actor = { id: technicianId, permissions: [...SERVISER_PERMISSIONS] }
    const created = await service.create(
      {
        orderNumber: `RN-HTTP-${crypto.randomUUID().slice(0, 8)}`,
        vehicleType: IntakeVehicleType.Car,
        plate: 'BG 774-LN',
        vehicle: 'Renault Master',
        arrivalMode: IntakeArrivalMode.Driven,
        ownerName: 'Petar Petrović',
        ownerPhone: '+381 60 111 2233',
        ...(ownerEmail === null ? {} : { ownerEmail }),
      },
      actorContext(),
    )
    await service.update(created.id, { checklist: { rezervna: true } }, actor, actorContext())
    await service.sign(
      created.id,
      { technicianSignature: 'M 0 0 L 1 1', ownerSignature: 'M 1 0 L 0 1', photosExpected: 0 },
      actor,
      actorContext(),
    )
    await service.produceDocument(created.id)
    return created.id
  }

  it('hands the file over as a download, under the number on the paper', async () => {
    const id = await orderWithDocument()
    const app = createIntakeTestApp(container, testUser([...OPERATOR_PERMISSIONS]))

    const response = await app.request(`/api/intake-orders/${id}/document`)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('RN-HTTP-')
    const body = Buffer.from(await response.arrayBuffer())
    expect(body.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('turns away a caller who may not see intake orders at all', async () => {
    const id = await orderWithDocument()
    const app = createIntakeTestApp(container, testUser(['claim_reports.view'] as Permission[]))

    expect((await app.request(`/api/intake-orders/${id}/document`)).status).toBe(403)
  })

  it('sends the sheet again on request, and answers with no content', async () => {
    const id = await orderWithDocument()
    const app = createIntakeTestApp(container, testUser([...OPERATOR_PERMISSIONS]))
    const sentBefore = email.sent.length

    const response = await app.request(`/api/intake-orders/${id}/send-document`, { method: 'POST' })

    expect(response.status).toBe(204)
    expect(email.sent).toHaveLength(sentBefore + 1)
  })

  it('refuses the resend to a serviser, who has every other right over his own order', async () => {
    const id = await orderWithDocument()
    const app = createIntakeTestApp(
      container,
      testUser([...SERVISER_PERMISSIONS], technicianId, ['serviser']),
    )

    // He may open it, photograph it and correct its specification — but this one leaves the shop.
    expect((await app.request(`/api/intake-orders/${id}/document`)).status).toBe(200)
    expect(
      (await app.request(`/api/intake-orders/${id}/send-document`, { method: 'POST' })).status,
    ).toBe(403)
  })

  it('answers 422 when the owner left no address to send to', async () => {
    const id = await orderWithDocument(null)
    const app = createIntakeTestApp(container, testUser([...OPERATOR_PERMISSIONS]))

    const response = await app.request(`/api/intake-orders/${id}/send-document`, { method: 'POST' })

    expect(response.status).toBe(422)
  })
})
