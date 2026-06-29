import { schema } from '@mr/db'
import { AuditAction, OPERATOR_PERMISSIONS, VIEWER_PERMISSIONS } from '@mr/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import {
  buildTestContainer,
  createAuditLogTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const ACTOR_A_ID = '77777777-7777-4777-8777-777777777777'
const ACTOR_B_ID = '77777777-7777-4777-8777-777777777778'

const ENTITY_EMOTIVE_ID = '88888888-8888-4888-8888-888888888881'
const ENTITY_CUSTOMER_ID = '88888888-8888-4888-8888-888888888882'
const ENTITY_USER_ID = '88888888-8888-4888-8888-888888888883'
const ENTITY_DOMACE_ID = '88888888-8888-4888-8888-888888888884'

const AUDIT_VIEW_PERMISSIONS = ['audit.view'] as const

interface AuditApiItem {
  id: string
  createdAt: string
  action: string
  entityType: string
  entityId: string
  actor: { id: string; name: string; email: string } | null
  actorIp: string | null
  actorUserAgent: string | null
  changes: unknown
  context: unknown
}

interface AuditApiResponse {
  items: AuditApiItem[]
  nextCursor: string | null
  hasMore: boolean
}

async function seedActors(db: TestDbContext['db']): Promise<void> {
  await db
    .insert(schema.users)
    .values([
      { id: ACTOR_A_ID, email: 'actor-a@mrengines.rs', name: 'Actor A' },
      { id: ACTOR_B_ID, email: 'actor-b@mrengines.rs', name: 'Actor B' },
    ])
    .onConflictDoNothing()
}

/** Baseline audit rows with controlled timestamps (newest = R4 login). */
async function seedAuditRows(db: TestDbContext['db']): Promise<void> {
  await db.insert(schema.auditLog).values([
    {
      entityType: 'emotive_claim',
      entityId: ENTITY_EMOTIVE_ID,
      action: AuditAction.Create,
      actorUserId: ACTOR_A_ID,
      actorIp: '192.168.1.10',
      actorUserAgent: 'Vitest/A',
      changes: { after: { mrNumber: 'MR-1' } },
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
    },
    {
      entityType: 'emotive_claim',
      entityId: ENTITY_EMOTIVE_ID,
      action: AuditAction.Update,
      actorUserId: ACTOR_A_ID,
      actorIp: '192.168.1.10',
      actorUserAgent: 'Vitest/A',
      changes: { before: { status: 'pending' }, after: { status: 'accepted' } },
      createdAt: new Date('2026-06-02T10:00:00.000Z'),
    },
    {
      entityType: 'customer',
      entityId: ENTITY_CUSTOMER_ID,
      action: AuditAction.Delete,
      actorUserId: ACTOR_B_ID,
      actorIp: '10.0.0.5',
      actorUserAgent: 'Vitest/B',
      changes: { before: { name: 'Old Firm' } },
      createdAt: new Date('2026-06-03T10:00:00.000Z'),
    },
    {
      entityType: 'user',
      entityId: ENTITY_USER_ID,
      action: AuditAction.Login,
      actorUserId: null,
      actorIp: null,
      actorUserAgent: null,
      changes: null,
      createdAt: new Date('2026-06-04T10:00:00.000Z'),
    },
    {
      entityType: 'domace_claim',
      entityId: ENTITY_DOMACE_ID,
      action: AuditAction.Create,
      actorUserId: ACTOR_B_ID,
      actorIp: '10.0.0.5',
      actorUserAgent: 'Vitest/B',
      changes: { after: { mrNumber: 'MR-OLD' } },
      createdAt: new Date('2025-01-01T10:00:00.000Z'),
    },
  ])
}

describe.sequential('Audit log module', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    // Other integration suites commit audit rows; isolate this suite to its own
    // fixtures. Safe — the delete lives inside this test's BEGIN/ROLLBACK tx.
    await ctx.db.delete(schema.auditLog)
    await seedActors(ctx.db)
    await seedAuditRows(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  describe('when listing the audit log', () => {
    it('returns entries newest-first with resolved actor and changes', async () => {
      const app = createAuditLogTestApp(
        container,
        testUser([...AUDIT_VIEW_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request('/api/audit-log')
      expect(response.status).toBe(200)

      const body = (await response.json()) as AuditApiResponse
      expect(body.items).toHaveLength(5)

      const [first] = body.items
      expect(first?.action).toBe(AuditAction.Login)
      expect(first?.entityType).toBe('user')
      expect(first?.actor).toBeNull()

      const update = body.items.find((item) => item.action === AuditAction.Update)
      expect(update?.actor).toEqual({
        id: ACTOR_A_ID,
        name: 'Actor A',
        email: 'actor-a@mrengines.rs',
      })
      expect(update?.changes).toEqual({
        before: { status: 'pending' },
        after: { status: 'accepted' },
      })
    })

    it('filters by action', async () => {
      const app = createAuditLogTestApp(
        container,
        testUser([...AUDIT_VIEW_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request(`/api/audit-log?action=${AuditAction.Create}`)
      expect(response.status).toBe(200)

      const body = (await response.json()) as AuditApiResponse
      expect(body.items).toHaveLength(2)
      expect(body.items.every((item) => item.action === AuditAction.Create)).toBe(true)
    })

    it('filters by entity type', async () => {
      const app = createAuditLogTestApp(
        container,
        testUser([...AUDIT_VIEW_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request('/api/audit-log?entityType=customer')
      expect(response.status).toBe(200)

      const body = (await response.json()) as AuditApiResponse
      expect(body.items).toHaveLength(1)
      expect(body.items[0]?.entityType).toBe('customer')
    })

    it('filters by actor', async () => {
      const app = createAuditLogTestApp(
        container,
        testUser([...AUDIT_VIEW_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request(`/api/audit-log?actorUserId=${ACTOR_A_ID}`)
      expect(response.status).toBe(200)

      const body = (await response.json()) as AuditApiResponse
      expect(body.items).toHaveLength(2)
      expect(body.items.every((item) => item.actor?.id === ACTOR_A_ID)).toBe(true)
    })

    it('filters by date range', async () => {
      const app = createAuditLogTestApp(
        container,
        testUser([...AUDIT_VIEW_PERMISSIONS], TEST_USER_ID),
      )

      const recent = await app.request('/api/audit-log?dateFrom=2026-01-01')
      expect(recent.status).toBe(200)
      const recentBody = (await recent.json()) as AuditApiResponse
      expect(recentBody.items).toHaveLength(4)

      const old = await app.request('/api/audit-log?dateTo=2025-12-31')
      expect(old.status).toBe(200)
      const oldBody = (await old.json()) as AuditApiResponse
      expect(oldBody.items).toHaveLength(1)
      expect(oldBody.items[0]?.entityType).toBe('domace_claim')
    })

    it('paginates by keyset across multiple pages without overlap', async () => {
      const app = createAuditLogTestApp(
        container,
        testUser([...AUDIT_VIEW_PERMISSIONS], TEST_USER_ID),
      )

      const seen = new Set<string>()
      let cursor: string | null = null
      let pages = 0

      do {
        const url: string =
          cursor === null
            ? '/api/audit-log?limit=2'
            : `/api/audit-log?limit=2&cursor=${encodeURIComponent(cursor)}`
        const response = await app.request(url)
        expect(response.status).toBe(200)

        const body = (await response.json()) as AuditApiResponse
        expect(body.items.length).toBeLessThanOrEqual(2)
        for (const item of body.items) {
          expect(seen.has(item.id)).toBe(false)
          seen.add(item.id)
        }

        cursor = body.nextCursor
        pages += 1
      } while (cursor !== null && pages < 10)

      expect(seen.size).toBe(5)
      expect(pages).toBe(3)
    })
  })

  describe('access control', () => {
    it('returns 403 for an operator (no audit.view)', async () => {
      const app = createAuditLogTestApp(
        container,
        testUser([...OPERATOR_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request('/api/audit-log')
      expect(response.status).toBe(403)
    })

    it('returns 403 for a viewer (no audit.view)', async () => {
      const app = createAuditLogTestApp(container, testUser([...VIEWER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request('/api/audit-log')
      expect(response.status).toBe(403)
    })

    it('returns 403 without any permission', async () => {
      const app = createAuditLogTestApp(container, testUser([], TEST_USER_ID))

      const response = await app.request('/api/audit-log')
      expect(response.status).toBe(403)
    })

    it('is read-only — no write route exists', async () => {
      const app = createAuditLogTestApp(
        container,
        testUser([...AUDIT_VIEW_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'user' }),
      })
      expect(response.status).toBe(404)
    })
  })
})
