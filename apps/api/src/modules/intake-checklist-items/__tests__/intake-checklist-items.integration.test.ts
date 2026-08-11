import { schema } from '@mr/db'
import { AuditAction } from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ConflictError } from '../../../core/errors/domain-errors.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import {
  buildTestContainer,
  createReferenceTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const ACTOR = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }
const MANAGE = ['settings.intake_checklist.manage'] as const
/** What the serviser who fills the wizard actually holds — no settings permission at all. */
const SERVISER = ['intake_orders.view_own', 'intake_orders.create'] as const

/** The eight codes intake orders already store, in the order the paper form uses (seed). */
const SEEDED_CODES = [
  'rezervna',
  'dizalica',
  'komplet',
  'saobracajna',
  'vozacka',
  'prvaPomoc',
  'prsluk',
  'lanci',
]

describe('Intake checklist items module', () => {
  let ctx: TestDbContext
  let container: Container

  async function listCodes(activeOnly: boolean, includeDeleted = false): Promise<string[]> {
    const page = await container.intakeChecklistItemsService.list({
      activeOnly,
      includeDeleted,
      limit: 50,
    })
    return page.items.map((item) => item.code)
  }

  async function idOfCode(code: string): Promise<string> {
    const page = await container.intakeChecklistItemsService.list({
      activeOnly: false,
      includeDeleted: false,
      limit: 50,
    })
    const item = page.items.find((row) => row.code === code)
    if (item === undefined) {
      throw new Error(`seed missing: ${code}`)
    }
    return item.id
  }

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('lists seeded items in sort order, and insertion order is NOT the order', async () => {
    expect(await listCodes(false)).toEqual(SEEDED_CODES)

    // Inserted last, sorts first: this is what pins the ORDER BY instead of Postgres's physical
    // row order, which for a freshly seeded table happens to match the expectation above.
    await container.intakeChecklistItemsService.create(
      { code: 'prvi', nameSr: 'Prvi', nameEn: 'First', sortOrder: 5 },
      ACTOR,
    )

    expect((await listCodes(false))[0]).toBe('prvi')
  })

  it('creates an item, and refuses a duplicate code with a conflict', async () => {
    const created = await container.intakeChecklistItemsService.create(
      { code: 'patosnici', nameSr: 'Gumeni patosnici', nameEn: 'Rubber mats', sortOrder: 90 },
      ACTOR,
    )
    expect(created.code).toBe('patosnici')
    expect(created.isActive).toBe(true)

    await expect(
      container.intakeChecklistItemsService.create(
        { code: 'patosnici', nameSr: 'Drugo ime', nameEn: 'Other name' },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('renames without touching the code, because orders store the code', async () => {
    const spareId = await idOfCode('rezervna')

    const renamed = await container.intakeChecklistItemsService.update(
      spareId,
      { nameSr: 'Rezervna guma (puna)' },
      ACTOR,
    )

    expect(renamed.nameSr).toBe('Rezervna guma (puna)')
    expect(renamed.code).toBe('rezervna')
  })

  it('hides a deactivated item from the picker but keeps it in the full list', async () => {
    const chainsId = await idOfCode('lanci')
    await container.intakeChecklistItemsService.update(chainsId, { isActive: false }, ACTOR)

    expect(await listCodes(true)).not.toContain('lanci')
    // The display path needs it: a signed order may hold this code (D3).
    expect(await listCodes(false)).toContain('lanci')
  })

  it('soft-deletes rather than destroying, so history still has a row to read', async () => {
    const chainsId = await idOfCode('lanci')

    await container.intakeChecklistItemsService.softDelete(chainsId, ACTOR)

    const rows = await ctx.db
      .select({ deletedAt: schema.intakeChecklistItems.deletedAt })
      .from(schema.intakeChecklistItems)
      .where(eq(schema.intakeChecklistItems.id, chainsId))
    // Both assertions matter: a hard delete leaves NO row, and `undefined` would slip past a
    // bare not-toBeNull check.
    expect(rows).toHaveLength(1)
    expect(rows[0]?.deletedAt).toBeInstanceOf(Date)

    expect(await listCodes(false)).not.toContain('lanci')
  })

  it('hands a removed item only to the display path, which must name every recorded code', async () => {
    const chainsId = await idOfCode('lanci')
    await container.intakeChecklistItemsService.softDelete(chainsId, ACTOR)

    // The picker and the admin screen are both done with it…
    expect(await listCodes(true)).not.toContain('lanci')
    expect(await listCodes(false)).not.toContain('lanci')
    // …but a signed order still holds this code, and the detail card and the printed sheet have to
    // put a NAME on that row rather than a bare code (plan D3).
    expect(await listCodes(false, true)).toContain('lanci')
  })

  it('searches across the code and both names', async () => {
    const page = await container.intakeChecklistItemsService.list({
      // Serbian name only ("Rezervna guma"), so a search that ignored nameSr would come back empty.
      search: 'guma',
      activeOnly: false,
      includeDeleted: false,
      limit: 50,
    })

    expect(page.items.map((item) => item.code)).toEqual(['rezervna'])
  })

  it('revives a retired code instead of failing on the unique index', async () => {
    const chainsId = await idOfCode('lanci')
    await container.intakeChecklistItemsService.softDelete(chainsId, ACTOR)

    const revived = await container.intakeChecklistItemsService.create(
      { code: 'lanci', nameSr: 'Lanci za snijeg', nameEn: 'Snow chains', sortOrder: 85 },
      ACTOR,
    )

    expect(revived.id).toBe(chainsId)
    expect(revived.nameSr).toBe('Lanci za snijeg')
    expect(await listCodes(false)).toContain('lanci')
  })

  it('audits a revival with what the row used to be, not as a blank create', async () => {
    const chainsId = await idOfCode('lanci')
    await container.intakeChecklistItemsService.softDelete(chainsId, ACTOR)
    await container.intakeChecklistItemsService.create(
      { code: 'lanci', nameSr: 'Lanci za snijeg', nameEn: 'Snow chains' },
      ACTOR,
    )

    const [entry] = await ctx.db
      .select({ changes: schema.auditLog.changes })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, chainsId),
          eq(schema.auditLog.action, AuditAction.Create),
          eq(schema.auditLog.entityType, 'intake_checklist_item'),
        ),
      )

    const changes = entry?.changes as
      | { before?: { nameSr?: string }; after?: { nameSr?: string } }
      | undefined
    // Same id as before, so the old names are only in the trail if the revival records them.
    expect(changes?.before?.nameSr).toBe('Lanci / alat')
    expect(changes?.after?.nameSr).toBe('Lanci za snijeg')
  })

  it('writes an audit row for every change', async () => {
    const created = await container.intakeChecklistItemsService.create(
      { code: 'kanister', nameSr: 'Kanister', nameEn: 'Jerry can' },
      ACTOR,
    )
    await container.intakeChecklistItemsService.update(created.id, { sortOrder: 95 }, ACTOR)
    await container.intakeChecklistItemsService.softDelete(created.id, ACTOR)

    const rows = await ctx.db
      .select({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, created.id))

    expect(rows.map((row) => row.action).sort()).toEqual(
      [AuditAction.Create, AuditAction.Delete, AuditAction.Update].sort(),
    )
  })

  describe('HTTP', () => {
    it('returns the paginated envelope fetchAllReferencePages reads', async () => {
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))
      const response = await app.request('/api/intake-checklist-items?limit=3')
      expect(response.status).toBe(200)

      const body: unknown = await response.json()
      expect(body).toMatchObject({ hasMore: true })
      const page = body as { items: unknown[]; nextCursor: string | null; hasMore: boolean }
      expect(page.items).toHaveLength(3)
      // A cursor must come back, or the fetcher stops after the first page and the wizard silently
      // offers a truncated catalog.
      expect(typeof page.nextCursor).toBe('string')
    })

    it('lets the serviser read the catalog without any settings permission', async () => {
      const app = createReferenceTestApp(container, testUser([...SERVISER], TEST_USER_ID))
      const response = await app.request('/api/intake-checklist-items')
      expect(response.status).toBe(200)
    })

    it('rejects POST without settings.intake_checklist.manage (403)', async () => {
      const app = createReferenceTestApp(container, testUser([...SERVISER], TEST_USER_ID))
      const response = await app.request('/api/intake-checklist-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'zabranjeno', nameSr: 'X', nameEn: 'X' }),
      })
      expect(response.status).toBe(403)
    })

    it('allows POST with settings.intake_checklist.manage (201)', async () => {
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))
      const response = await app.request('/api/intake-checklist-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'dozvoljeno', nameSr: 'OK', nameEn: 'OK', sortOrder: 99 }),
      })
      expect(response.status).toBe(201)
    })

    it('refuses to change the code on PATCH, because an order stores it', async () => {
      const spareId = await idOfCode('rezervna')
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))

      const response = await app.request(`/api/intake-checklist-items/${spareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'nova_sifra' }),
      })

      // `code` is not in the update schema, so a body carrying only `code` has no updatable field.
      expect(response.status).toBe(400)
      expect(await listCodes(false)).toContain('rezervna')
    })

    it('refuses a PATCH that smuggles a code alongside a real field, instead of ignoring it', async () => {
      const spareId = await idOfCode('rezervna')
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))

      const response = await app.request(`/api/intake-checklist-items/${spareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'nova_sifra', nameSr: 'Rezervna guma (puna)' }),
      })

      // Silently stripping `code` would answer 200 and change nothing about it — the admin would be
      // told the edit worked. Refuse loudly and apply NOTHING.
      expect(response.status).toBe(400)
      const item = await container.intakeChecklistItemsRepository.findById(spareId)
      expect(item?.nameSr).toBe('Rezervna guma')
      expect(item?.code).toBe('rezervna')
    })

    it('passes includeDeleted=true across the wire for the display path', async () => {
      const chainsId = await idOfCode('lanci')
      await container.intakeChecklistItemsService.softDelete(chainsId, ACTOR)
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))

      const withoutFlag = await app.request('/api/intake-checklist-items?activeOnly=false')
      const withFlag = await app.request(
        '/api/intake-checklist-items?activeOnly=false&includeDeleted=true',
      )

      const codesOf = async (response: Response): Promise<string[]> => {
        const page = (await response.json()) as { items: { code: string }[] }
        return page.items.map((item) => item.code)
      }
      expect(await codesOf(withoutFlag)).not.toContain('lanci')
      expect(await codesOf(withFlag)).toContain('lanci')
    })

    it('deletes over HTTP with 204 and leaves the row soft-deleted', async () => {
      const chainsId = await idOfCode('lanci')
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))

      const response = await app.request(`/api/intake-checklist-items/${chainsId}`, {
        method: 'DELETE',
      })

      expect(response.status).toBe(204)
      const rows = await ctx.db
        .select({ deletedAt: schema.intakeChecklistItems.deletedAt })
        .from(schema.intakeChecklistItems)
        .where(eq(schema.intakeChecklistItems.id, chainsId))
      expect(rows[0]?.deletedAt).toBeInstanceOf(Date)
    })
  })
})
