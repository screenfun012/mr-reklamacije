import {
  IntakeArrivalMode,
  IntakeVehicleType,
  OPERATOR_PERMISSIONS,
  SERVISER_PERMISSIONS,
  type IntakeOrderDetail,
  type Permission,
} from '@mr/shared'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppVariables } from '../../../app.js'
import type { Container } from '../../../core/container.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { buildTestContainer, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { registerIntakeOrdersRoutes } from '../index.js'

/**
 * The quote as the browser reaches it: multipart in, permissions in front, status codes out.
 *
 * The service suite covers what these routes CALL. Only this layer can answer whether the upload
 * survives the trip through `formData()` and the body-limit middleware — the first browser attempt
 * answered 500 while every service test was green, and nothing below HTTP could have caught it.
 */
function createApp(
  container: Container,
  permissions: readonly Permission[] | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)
  app.use('*', async (c, next) => {
    c.set('user', permissions === null ? null : testUser([...permissions]))
    c.set('session', null)
    await next()
  })
  registerIntakeOrdersRoutes(app, container)
  return app
}

function quoteForm(fileName = 'ponuda.pdf'): FormData {
  const formData = new FormData()
  // A real PDF header: the pipeline reads magic bytes, never the name or the declared type.
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25])
  formData.append('files', new File([bytes], fileName, { type: 'application/pdf' }))
  return formData
}

describe('the quote routes', () => {
  let ctx: TestDbContext
  let container: Container
  let orderId: string
  let technicianId: string

  const actorContext = (): { actorUserId: string; actorIp: null; actorUserAgent: null } => ({
    actorUserId: technicianId,
    actorIp: null,
    actorUserAgent: null,
  })

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    // The order must belong to the user the requests run as: a serviser sees only his own, so a
    // different technician would make every one of these 404 for the right reason and the wrong test.
    await ensureTestUser(ctx.db)
    technicianId = TEST_USER_ID
    orderId = await signedOrder()
  })

  /** A finished intake, which is the only kind that may carry a quote. */
  async function signedOrder(): Promise<string> {
    const service = container.intakeOrdersService
    const actor = { id: technicianId, permissions: [...SERVISER_PERMISSIONS] }
    const created = await service.create(
      {
        orderNumber: `RN-Q-${crypto.randomUUID().slice(0, 8)}`,
        vehicleType: IntakeVehicleType.Car,
        plate: 'BG 774-LN',
        vehicle: 'Renault Master',
        arrivalMode: IntakeArrivalMode.Driven,
        ownerName: 'Petar Petrović',
        ownerPhone: '+381 60 111 2233',
        ownerEmail: 'vlasnik@example.com',
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
    return created.id
  }

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('takes the file over multipart and answers with the order that now carries it', async () => {
    const app = createApp(container, [...SERVISER_PERMISSIONS, 'intake_orders.attach_quote'])

    const response = await app.request(`/api/intake-orders/${orderId}/quote`, {
      method: 'POST',
      body: quoteForm(),
    })

    expect(response.status).toBe(200)
    const order = (await response.json()) as IntakeOrderDetail
    expect(order.quote?.fileName).toBe('ponuda.pdf')
    expect(order.quote?.mimeType).toBe('application/pdf')
  })

  it('serves it back under its own name, as a download', async () => {
    const app = createApp(container, [...SERVISER_PERMISSIONS, 'intake_orders.attach_quote'])
    await app.request(`/api/intake-orders/${orderId}/quote`, { method: 'POST', body: quoteForm() })

    const response = await app.request(`/api/intake-orders/${orderId}/quote`)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('ponuda.pdf')
  })

  it('lets anyone who may open the order read it, and nobody else attach one', async () => {
    const attacher = createApp(container, [...SERVISER_PERMISSIONS, 'intake_orders.attach_quote'])
    await attacher.request(`/api/intake-orders/${orderId}/quote`, {
      method: 'POST',
      body: quoteForm(),
    })

    // The office may read it without holding the attach right — the same rule the sealed papers
    // follow: whoever may open the order may take its papers.
    const office = createApp(container, [...OPERATOR_PERMISSIONS])
    expect((await office.request(`/api/intake-orders/${orderId}/quote`)).status).toBe(200)

    const attempt = await office.request(`/api/intake-orders/${orderId}/quote`, {
      method: 'POST',
      body: quoteForm(),
    })
    expect(attempt.status).toBe(403)
  })
})
