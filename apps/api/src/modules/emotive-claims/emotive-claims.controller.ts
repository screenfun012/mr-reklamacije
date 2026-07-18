import { toClientClaimDetail, toClientClaimListItem, type ClientClaimDetail } from '@mr/shared'
import type { Context } from 'hono'
import { z } from 'zod'

import type { Container } from '../../core/container.js'
import type { MRSessionUser } from '../../core/auth/session-types.js'
import { getActorContext } from '../../core/http/actor-context.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { EmotiveClaimsActor } from './emotive-claims.types.js'
import type { EmotiveClaimDetail } from './emotive-claims.validators.js'
import {
  EmotiveClaimChangeOutcomeInputSchema,
  EmotiveClaimCreateInputSchema,
  EmotiveClaimListQuerySchema,
  EmotiveClaimUpdateInputSchema,
} from './emotive-claims.validators.js'

const EmotiveClaimIdParamSchema = z.object({
  id: z.string().uuid(),
})

function toActor(user: MRSessionUser): EmotiveClaimsActor {
  return { id: user.id, permissions: user.permissions }
}

/**
 * Field breadth follows the VIEW SCOPE, not the role name. Holders of the full
 * `emotive_claims.view` permission (operator / viewer / admin) get the raw
 * internal claim; an own-customer-scoped actor — the `client` role today, or
 * ANY future partner role holding only `emotive_claims.view_own_customer` —
 * gets the strict whitelist. This is the SAME permission the service uses for
 * ROW scope (resolveListScope), so field breadth and row access can never
 * disagree, and a new scoped role is whitelisted automatically with no code
 * change (the whole point of the whitelist safety net).
 */
function hasFullClaimView(user: MRSessionUser): boolean {
  return user.permissions.includes('emotive_claims.view')
}

function serializeClaimDetail(
  detail: EmotiveClaimDetail,
  user: MRSessionUser,
): EmotiveClaimDetail | ClientClaimDetail {
  if (hasFullClaimView(user)) {
    return detail
  }

  // Scoped viewers get a strict whitelist — no faults (krivica), no handler, no
  // internal notes, no source, no pricing.
  return toClientClaimDetail(detail)
}

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

export function createEmotiveClaimsController(container: Container) {
  return {
    list: async (c: Context) => {
      const user = requireUser(c)
      const query = EmotiveClaimListQuerySchema.parse(c.req.query())
      const result = await container.emotiveClaimsService.list(query, toActor(user))
      if (!hasFullClaimView(user)) {
        return c.json({ ...result, items: result.items.map(toClientClaimListItem) })
      }
      return c.json(result)
    },

    findById: async (c: Context) => {
      const user = requireUser(c)
      const { id } = EmotiveClaimIdParamSchema.parse(c.req.param())
      const claim = await container.emotiveClaimsService.findById(id, toActor(user))
      return c.json(serializeClaimDetail(claim, user))
    },

    create: async (c: Context) => {
      const user = requireUser(c)
      const body: unknown = await c.req.json()
      const input = EmotiveClaimCreateInputSchema.parse(body)
      const created = await container.emotiveClaimsService.create(
        input,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(created, user), 201)
    },

    update: async (c: Context) => {
      const user = requireUser(c)
      const { id } = EmotiveClaimIdParamSchema.parse(c.req.param())
      const body: unknown = await c.req.json()
      const input = EmotiveClaimUpdateInputSchema.parse(body)
      const updated = await container.emotiveClaimsService.update(
        id,
        input,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(updated, user))
    },

    softDelete: async (c: Context) => {
      const user = requireUser(c)
      const { id } = EmotiveClaimIdParamSchema.parse(c.req.param())
      await container.emotiveClaimsService.softDelete(id, toActor(user), getActorContext(c, user))
      return c.body(null, 204)
    },

    restore: async (c: Context) => {
      const user = requireUser(c)
      const { id } = EmotiveClaimIdParamSchema.parse(c.req.param())
      const restored = await container.emotiveClaimsService.restore(
        id,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(restored, user))
    },

    changeOutcome: async (c: Context) => {
      const user = requireUser(c)
      const { id } = EmotiveClaimIdParamSchema.parse(c.req.param())
      const body: unknown = await c.req.json()
      const input = EmotiveClaimChangeOutcomeInputSchema.parse(body)
      const updated = await container.emotiveClaimsService.changeOutcome(
        id,
        input,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(serializeClaimDetail(updated, user))
    },

    publish: async (c: Context) => {
      const user = requireUser(c)
      const { id } = EmotiveClaimIdParamSchema.parse(c.req.param())
      const updated = await container.emotiveClaimsService.publish(id, getActorContext(c, user))
      return c.json(serializeClaimDetail(updated, user))
    },

    markSeen: async (c: Context) => {
      const user = requireUser(c)
      const { id } = EmotiveClaimIdParamSchema.parse(c.req.param())
      await container.emotiveClaimsService.markClientSeen(id, toActor(user))
      return c.body(null, 204)
    },
  }
}
