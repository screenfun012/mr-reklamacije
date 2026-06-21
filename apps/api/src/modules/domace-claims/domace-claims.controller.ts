import { SYSTEM_ROLE_CLIENT } from '@mr/shared'
import type { Context } from 'hono'
import { z } from 'zod'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import type { DomaceClaimsActor } from './domace-claims.types.js'
import type { DomaceClaimDetail } from './domace-claims.validators.js'
import {
  DomaceClaimAmountInputSchema,
  DomaceClaimChangeOutcomeInputSchema,
  DomaceClaimCreateInputSchema,
  DomaceClaimListQuerySchema,
  DomaceClaimUpdateInputSchema,
} from './domace-claims.validators.js'

const DomaceClaimIdParamSchema = z.object({
  id: z.string().uuid(),
})

function toActor(user: MRSessionUser): DomaceClaimsActor {
  return { id: user.id, permissions: user.permissions }
}

function isClientRole(user: MRSessionUser): boolean {
  return user.roles.includes(SYSTEM_ROLE_CLIENT)
}

function serializeClaimDetail(
  detail: DomaceClaimDetail,
  user: MRSessionUser,
): DomaceClaimDetail | Omit<DomaceClaimDetail, 'internalNotes'> {
  if (!isClientRole(user)) {
    return detail
  }

  const { internalNotes, ...withoutInternalNotes } = detail
  void internalNotes
  return withoutInternalNotes
}

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

export function createDomaceClaimsController(container: Container) {
  return {
    list: async (c: Context) => {
      const user = requireUser(c)
      const query = DomaceClaimListQuerySchema.parse(c.req.query())
      const result = await container.domaceClaimsService.list(query, toActor(user))
      return c.json(result)
    },

    findById: async (c: Context) => {
      const user = requireUser(c)
      const { id } = DomaceClaimIdParamSchema.parse(c.req.param())
      const claim = await container.domaceClaimsService.findById(id, toActor(user))
      return c.json(serializeClaimDetail(claim, user))
    },

    create: async (c: Context) => {
      const user = requireUser(c)
      const body: unknown = await c.req.json()
      const input = DomaceClaimCreateInputSchema.parse(body)
      const created = await container.domaceClaimsService.create(
        input,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(created, user), 201)
    },

    update: async (c: Context) => {
      const user = requireUser(c)
      const { id } = DomaceClaimIdParamSchema.parse(c.req.param())
      const body: unknown = await c.req.json()
      const input = DomaceClaimUpdateInputSchema.parse(body)
      const updated = await container.domaceClaimsService.update(
        id,
        input,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(updated, user))
    },

    softDelete: async (c: Context) => {
      const user = requireUser(c)
      const { id } = DomaceClaimIdParamSchema.parse(c.req.param())
      await container.domaceClaimsService.softDelete(id, toActor(user), getActorContext(c, user))
      return c.body(null, 204)
    },

    restore: async (c: Context) => {
      const user = requireUser(c)
      const { id } = DomaceClaimIdParamSchema.parse(c.req.param())
      const restored = await container.domaceClaimsService.restore(
        id,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(restored, user))
    },

    changeOutcome: async (c: Context) => {
      const user = requireUser(c)
      const { id } = DomaceClaimIdParamSchema.parse(c.req.param())
      const body: unknown = await c.req.json()
      const input = DomaceClaimChangeOutcomeInputSchema.parse(body)
      const updated = await container.domaceClaimsService.changeOutcome(
        id,
        input,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(updated, user))
    },

    updateAmount: async (c: Context) => {
      const user = requireUser(c)
      const { id } = DomaceClaimIdParamSchema.parse(c.req.param())
      const body: unknown = await c.req.json()
      const input = DomaceClaimAmountInputSchema.parse(body)
      const updated = await container.domaceClaimsService.updateAmount(
        id,
        input,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(updated, user))
    },
  }
}
