import { schema } from '@mr/db'
import { ClientSubmissionStatus, CustomerKind, ERROR_CODE } from '@mr/shared'
import { inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppVariables } from '../../../app.js'
import type { MRSessionUser } from '../../../core/auth/session-types.js'
import type { Container } from '../../../core/container.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { registerClientSubmissionsRoutes } from '../index.js'

const CLIENT_PERMS = ['client_submissions.create'] as const
const MANAGE_PERMS = ['client_submissions.manage'] as const

function createClientSubmissionsTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerClientSubmissionsRoutes(app, container)

  return app
}

function suffix(): string {
  return crypto.randomUUID().slice(0, 8)
}

describe('ClientSubmissions HTTP', () => {
  let ctx: TestDbContext
  let container: Container
  // The convert path commits (db.transaction) on the shared single-connection harness, so its
  // rows survive the per-test ROLLBACK — track created submissions and delete them so the
  // repository suite's global `listPending` count stays accurate.
  let submissionCleanup: string[]

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    submissionCleanup = []
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    if (submissionCleanup.length > 0) {
      await ctx.db
        .delete(schema.clientSubmissions)
        .where(inArray(schema.clientSubmissions.id, submissionCleanup))
    }
    await ctx.cleanup()
  })

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db
      .insert(schema.users)
      .values({ id, email: `cs-http-${id}@mrengines.rs`, name: 'CS' })
    return id
  }

  async function seedCustomer(): Promise<string> {
    const [customer] = await ctx.db
      .insert(schema.customers)
      .values({ kind: CustomerKind.EmotivePartner, name: `Partner ${suffix()}` })
      .returning({ id: schema.customers.id })
    return customer!.id
  }

  async function linkUserToCustomer(customerId: string, userId: string): Promise<void> {
    await ctx.db
      .insert(schema.customerUsers)
      .values({ customerId, userId, assignedBy: TEST_USER_ID })
  }

  async function seedEngineType(): Promise<string> {
    const [engineType] = await ctx.db
      .insert(schema.engineTypes)
      .values({ code: `CS-HTTP-ENG-${suffix()}` })
      .returning({ id: schema.engineTypes.id })
    return engineType!.id
  }

  async function seedSubmission(customerId: string, message: string): Promise<string> {
    const { id } = await container.clientSubmissionsRepository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message,
    })
    submissionCleanup.push(id)
    return id
  }

  describe('POST /api/client-submissions', () => {
    it('creates a submission for a linked client → 201 { id } + Location', async () => {
      const clientId = await seedUser()
      const customerId = await seedCustomer()
      await linkUserToCustomer(customerId, clientId)

      const app = createClientSubmissionsTestApp(
        container,
        testUser([...CLIENT_PERMS], clientId, ['client']),
      )
      const res = await app.request('/api/client-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Motor lupa nakon ugradnje' }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as { id: string }
      expect(body.id.length).toBeGreaterThan(0)
      expect(res.headers.get('Location')).toBe(`/api/client-submissions/${body.id}`)

      const stored = await container.clientSubmissionsRepository.findById(body.id)
      expect(stored).toMatchObject({
        customerId,
        message: 'Motor lupa nakon ugradnje',
        status: ClientSubmissionStatus.Pending,
      })
    })

    it('rejects an empty message with 400 (Zod → ValidationError)', async () => {
      const clientId = await seedUser()
      const customerId = await seedCustomer()
      await linkUserToCustomer(customerId, clientId)

      const app = createClientSubmissionsTestApp(
        container,
        testUser([...CLIENT_PERMS], clientId, ['client']),
      )
      const res = await app.request('/api/client-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      })

      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.ValidationError)
    })

    it('returns 401 without auth', async () => {
      const app = createClientSubmissionsTestApp(container, null)
      const res = await app.request('/api/client-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'x' }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe('manage routes are denied to the client role', () => {
    it('returns 403 when a client hits GET /api/client-submissions', async () => {
      const clientId = await seedUser()
      const app = createClientSubmissionsTestApp(
        container,
        testUser([...CLIENT_PERMS], clientId, ['client']),
      )
      const res = await app.request('/api/client-submissions')
      expect(res.status).toBe(403)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)
    })
  })

  describe('GET /api/client-submissions', () => {
    it('lists pending submissions for an operator', async () => {
      const customerId = await seedCustomer()
      const first = await seedSubmission(customerId, `pending one ${suffix()}`)
      const second = await seedSubmission(customerId, `pending two ${suffix()}`)

      const app = createClientSubmissionsTestApp(container, testUser([...MANAGE_PERMS]))
      const res = await app.request('/api/client-submissions?status=pending&page=1&pageSize=50')

      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        items: Array<{ id: string; status: string }>
        total: number
        page: number
        pageSize: number
      }
      expect(body.page).toBe(1)
      expect(body.pageSize).toBe(50)
      expect(body.total).toBeGreaterThanOrEqual(2)
      expect(body.items.some((item) => item.id === first)).toBe(true)
      expect(body.items.some((item) => item.id === second)).toBe(true)
      expect(body.items.every((item) => item.status === ClientSubmissionStatus.Pending)).toBe(true)
    })
  })

  describe('GET /api/client-submissions/:id', () => {
    it('returns the detail for an operator', async () => {
      const customerId = await seedCustomer()
      const id = await seedSubmission(customerId, 'Detalji zahteva')

      const app = createClientSubmissionsTestApp(container, testUser([...MANAGE_PERMS]))
      const res = await app.request(`/api/client-submissions/${id}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as { id: string; message: string; status: string }
      expect(body.id).toBe(id)
      expect(body.message).toBe('Detalji zahteva')
      expect(body.status).toBe(ClientSubmissionStatus.Pending)
    })

    it('returns 404 for a missing submission', async () => {
      const app = createClientSubmissionsTestApp(container, testUser([...MANAGE_PERMS]))
      const res = await app.request('/api/client-submissions/00000000-0000-4000-8000-0000000000ff')
      expect(res.status).toBe(404)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.NotFound)
    })

    it('returns 400 for a non-uuid id', async () => {
      const app = createClientSubmissionsTestApp(container, testUser([...MANAGE_PERMS]))
      const res = await app.request('/api/client-submissions/not-a-uuid')
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.ValidationError)
    })
  })

  describe('POST /api/client-submissions/:id/convert', () => {
    it('converts a pending submission into an EMOTIVE claim (201) and marks it converted', async () => {
      const customerId = await seedCustomer()
      const engineTypeId = await seedEngineType()
      const submissionId = await seedSubmission(customerId, 'Klijentov razlog reklamacije')
      const mrNumber = `CS-HTTP-CONV-${suffix()}/26`

      const app = createClientSubmissionsTestApp(container, testUser([...MANAGE_PERMS]))
      const res = await app.request(`/api/client-submissions/${submissionId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineTypeId, dateOfClaim: '2026-07-01', mrNumber }),
      })

      expect(res.status).toBe(201)
      const claim = (await res.json()) as {
        id: string
        customerId: string | null
        warrantyReport: string | null
        mrNumber: string
      }
      expect(claim.customerId).toBe(customerId)
      expect(claim.warrantyReport).toBe('Klijentov razlog reklamacije')
      expect(claim.mrNumber).toBe(mrNumber)

      const detailRes = await app.request(`/api/client-submissions/${submissionId}`)
      expect(detailRes.status).toBe(200)
      const detail = (await detailRes.json()) as {
        status: string
        linkedEmotiveClaimId: string | null
      }
      expect(detail.status).toBe(ClientSubmissionStatus.Converted)
      expect(detail.linkedEmotiveClaimId).toBe(claim.id)
    })

    it('returns 403 for a client', async () => {
      const clientId = await seedUser()
      const customerId = await seedCustomer()
      const submissionId = await seedSubmission(customerId, 'nedozvoljeno')

      const app = createClientSubmissionsTestApp(
        container,
        testUser([...CLIENT_PERMS], clientId, ['client']),
      )
      const res = await app.request(`/api/client-submissions/${submissionId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineTypeId: crypto.randomUUID(),
          dateOfClaim: '2026-07-01',
          mrNumber: `CS-HTTP-DENY-${suffix()}/26`,
        }),
      })
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/client-submissions/:id/reject', () => {
    it('rejects a pending submission → 204 and marks it rejected', async () => {
      const customerId = await seedCustomer()
      const submissionId = await seedSubmission(customerId, 'Za odbijanje')

      const app = createClientSubmissionsTestApp(container, testUser([...MANAGE_PERMS]))
      const res = await app.request(`/api/client-submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Van garantnog roka' }),
      })

      expect(res.status).toBe(204)

      const detail = await container.clientSubmissionsRepository.findById(submissionId)
      expect(detail).toMatchObject({
        status: ClientSubmissionStatus.Rejected,
        rejectedReason: 'Van garantnog roka',
      })
    })
  })
})
