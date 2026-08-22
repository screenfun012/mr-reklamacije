import { createCachedPermissionResolver, getPermissionCacheEntryCount } from '@mr/auth'
import { schema } from '@mr/db'
import { SYSTEM_ROLE_OPERATOR, type Permission } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ForbiddenError } from '../../../core/errors/domain-errors.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const ACTOR = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }

const INTAKE: readonly Permission[] = ['intake_orders.view', 'intake_orders.create']
const ALL_OF_THEM: readonly Permission[] = [...INTAKE, 'intake_orders.send_document']

describe('Roles module', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('creates a set, and the list counts the people and the actions', async () => {
    const created = await container.rolesService.create(
      { nameSr: 'Prijem — rad na terenu', nameEn: 'Intake — field work', permissions: [...INTAKE] },
      ACTOR,
      ALL_OF_THEM,
    )

    expect(created.isSystem).toBe(false)
    expect(created.permissions.sort()).toEqual([...INTAKE].sort())
    // Serbian letters never reach the code column — other code compares against it.
    expect(created.code).toBe('intake_field_work')

    const listed = (await container.rolesService.list()).find((role) => role.id === created.id)

    expect(listed?.userCount).toBe(0)
    expect(listed?.permissionCount).toBe(2)
  })

  it('refuses to hand out an action the author does not hold', async () => {
    await expect(
      container.rolesService.create(
        { nameSr: 'Sve', nameEn: 'Everything', permissions: ['intake_orders.send_document'] },
        ACTOR,
        [...INTAKE],
      ),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lets an author REMOVE an action they do not hold, but not add one', async () => {
    const created = await container.rolesService.create(
      { nameSr: 'Puno', nameEn: 'Full', permissions: [...ALL_OF_THEM] },
      ACTOR,
      ALL_OF_THEM,
    )

    // Taking something away is never an escalation — and if it were refused, a set could never be
    // shrunk once its author lost the action it holds.
    const shrunk = await container.rolesService.update(
      created.id,
      { permissions: [...INTAKE] },
      ACTOR,
      [...INTAKE],
    )

    expect(shrunk.permissions.sort()).toEqual([...INTAKE].sort())

    await expect(
      container.rolesService.update(created.id, { permissions: [...ALL_OF_THEM] }, ACTOR, [
        ...INTAKE,
      ]),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('will not touch a built-in set', async () => {
    const operator = (await container.rolesService.list()).find(
      (role) => role.code === SYSTEM_ROLE_OPERATOR,
    )

    if (operator === undefined) throw new Error('operator role missing — seedRoles did not run')

    await expect(
      container.rolesService.update(operator.id, { nameSr: 'Novo ime' }, ACTOR, ALL_OF_THEM),
    ).rejects.toThrow()
    await expect(container.rolesService.softDelete(operator.id, ACTOR)).rejects.toThrow()
  })

  it('will not delete a set somebody holds, and says how many', async () => {
    const created = await container.rolesService.create(
      { nameSr: 'U upotrebi', nameEn: 'In use', permissions: [...INTAKE] },
      ACTOR,
      ALL_OF_THEM,
    )

    await ctx.db
      .insert(schema.userRoles)
      .values({ userId: TEST_USER_ID, roleId: created.id, assignedBy: TEST_USER_ID })

    await expect(container.rolesService.softDelete(created.id, ACTOR)).rejects.toThrow(/1 osoba/)

    await ctx.db.delete(schema.userRoles).where(eq(schema.userRoles.roleId, created.id))
    await container.rolesService.softDelete(created.id, ACTOR)

    expect((await container.rolesService.list()).some((role) => role.id === created.id)).toBe(false)
  })

  it('ends the session of everyone holding a set the moment it changes', async () => {
    const created = await container.rolesService.create(
      { nameSr: 'Menja se', nameEn: 'Changes', permissions: [...ALL_OF_THEM] },
      ACTOR,
      ALL_OF_THEM,
    )

    await ctx.db
      .insert(schema.userRoles)
      .values({ userId: TEST_USER_ID, roleId: created.id, assignedBy: TEST_USER_ID })
    await ctx.db.insert(schema.sessions).values({
      token: `roles-test-${created.id}`,
      userId: TEST_USER_ID,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    await container.rolesService.update(created.id, { permissions: [...INTAKE] }, ACTOR, INTAKE)

    const remaining = await ctx.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, TEST_USER_ID))

    // Without this the person keeps the action that was just taken away, for up to seven days.
    expect(remaining).toHaveLength(0)
  })

  it('drops the permission cache the moment a set changes', async () => {
    // The revoke above is NOT what makes a change take effect: permissions are not stored in a
    // session — `customSession` recomputes them on every request, from a module-level Map keyed by
    // sorted role codes with a 5-minute TTL. Clearing that Map is the step that takes a removed
    // action away on the very next request, and it is the one nothing was watching: removing
    // `clearPermissionCache()` from the service left all eight tests in this file green.
    //
    // `permission-cache.test.ts` proves the Map clears when told. This proves it is told.
    const created = await container.rolesService.create(
      { nameSr: 'Kes se obara', nameEn: 'Cache drops', permissions: [...ALL_OF_THEM] },
      ACTOR,
      ALL_OF_THEM,
    )

    const cached = createCachedPermissionResolver({
      resolveForRoles: async () => Promise.resolve([...ALL_OF_THEM]),
    })
    await cached.resolveForRoles([created.code])
    expect(getPermissionCacheEntryCount()).toBeGreaterThan(0)

    await container.rolesService.update(created.id, { permissions: [...INTAKE] }, ACTOR, INTAKE)

    expect(getPermissionCacheEntryCount()).toBe(0)
  })

  it('copies a set, actions and all', async () => {
    const source = await container.rolesService.create(
      { nameSr: 'Izvor', nameEn: 'Source', permissions: [...INTAKE] },
      ACTOR,
      ALL_OF_THEM,
    )

    const copy = await container.rolesService.duplicate(
      source.id,
      { nameSr: 'Kopija', nameEn: 'Copy' },
      ACTOR,
      ALL_OF_THEM,
    )

    expect(copy.id).not.toBe(source.id)
    expect(copy.code).not.toBe(source.code)
    expect(copy.permissions.sort()).toEqual(source.permissions.sort())
  })

  it('serves the matrix with names a person can read', async () => {
    const catalog = await container.rolesRepository.listPermissionCatalog()
    const sendDocument = catalog.find((item) => item.id === 'intake_orders.send_document')

    expect(catalog).toHaveLength(87)
    expect(sendDocument?.nameSr).toBe('Šalje papir vlasniku na mejl')
    expect(sendDocument?.module).toBe('intake_orders')
  })
})
