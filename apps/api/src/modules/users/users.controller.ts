import type { Context } from 'hono'

import { getActorContext } from '../../core/http/actor-context.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { Container } from '../../core/container.js'
import {
  UserAccountStatusPatchInputSchema,
  UserIdParamSchema,
  UserPasswordResetInputSchema,
  UserRolesReplaceInputSchema,
  UsersListQuerySchema,
} from './users.validators.js'

export function createUsersController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = UsersListQuerySchema.parse(c.req.query())
      const result = await container.usersService.list(query)
      return c.json(result)
    },

    updateAccountStatus: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = UserIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = UserAccountStatusPatchInputSchema.parse(body)
      const updated = await container.usersService.updateAccountStatus(id, input, {
        ...getActorContext(c, user),
        permissions: user.permissions ?? [],
      })

      return c.json(updated)
    },

    replaceRoles: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = UserIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = UserRolesReplaceInputSchema.parse(body)
      const updated = await container.usersService.replaceRoles(id, input, getActorContext(c, user))

      return c.json(updated)
    },

    resetPassword: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = UserIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = UserPasswordResetInputSchema.parse(body)
      await container.usersService.resetPassword(id, input, getActorContext(c, user))

      return c.body(null, 204)
    },

    resendActivation: async (c: Context) => {
      const user = c.get('user')
      if (user === null) {
        throw new UnauthorizedError()
      }

      const { id } = UserIdParamSchema.parse({ id: c.req.param('id') })
      const result = await container.usersService.resendActivation(id, getActorContext(c, user))

      return c.json(result)
    },
  }
}
