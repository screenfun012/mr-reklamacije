import type { Permission } from '@mr/shared'
import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import {
  RoleCreateInputSchema,
  RoleDuplicateInputSchema,
  RoleIdParamSchema,
  RoleUpdateInputSchema,
} from './roles.validators.js'

export function createRolesController(container: Container) {
  /**
   * The session's own effective actions. They are what "you cannot hand out what you do not hold"
   * is judged against, so they are read here rather than re-derived in the service — the session is
   * where the resolver already put them.
   */
  const actorOf = (c: Context) => {
    const user = c.get('user')
    if (user === null) {
      throw new UnauthorizedError()
    }
    return {
      context: getActorContext(c, user),
      permissions: (user.permissions ?? []) as readonly Permission[],
    }
  }

  return {
    list: async (c: Context) => {
      const items = await container.rolesService.list()
      return c.json({ items })
    },

    detail: async (c: Context) => {
      const { id } = RoleIdParamSchema.parse({ id: c.req.param('id') })
      return c.json(await container.rolesService.findById(id))
    },

    create: async (c: Context) => {
      const actor = actorOf(c)
      const body: unknown = await c.req.json()
      const input = RoleCreateInputSchema.parse(body)
      const created = await container.rolesService.create(input, actor.context, actor.permissions)
      return c.json(created, 201, { Location: `/api/roles/${created.id}` })
    },

    update: async (c: Context) => {
      const actor = actorOf(c)
      const { id } = RoleIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = RoleUpdateInputSchema.parse(body)
      return c.json(
        await container.rolesService.update(id, input, actor.context, actor.permissions),
      )
    },

    duplicate: async (c: Context) => {
      const actor = actorOf(c)
      const { id } = RoleIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const names = RoleDuplicateInputSchema.parse(body)
      const created = await container.rolesService.duplicate(
        id,
        names,
        actor.context,
        actor.permissions,
      )
      return c.json(created, 201, { Location: `/api/roles/${created.id}` })
    },

    remove: async (c: Context) => {
      const actor = actorOf(c)
      const { id } = RoleIdParamSchema.parse({ id: c.req.param('id') })
      await container.rolesService.softDelete(id, actor.context)
      return c.body(null, 204)
    },

    listPermissions: async (c: Context) => {
      const items = await container.rolesRepository.listPermissionCatalog()
      return c.json({ items })
    },
  }
}
