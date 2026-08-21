import { ClaimKind, toClientClaimListItem, type Permission } from '@mr/shared'
import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import type { MRSessionUser } from '../../core/auth/session-types.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { ClaimListQuerySchema } from './claims.validators.js'
import type { ClaimsActor } from './claims.types.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (!user) {
    throw new UnauthorizedError()
  }
  return user
}

function toActor(user: MRSessionUser): ClaimsActor {
  return {
    id: user.id,
    permissions: user.permissions ?? [],
  }
}

/**
 * Field breadth follows the VIEW SCOPE per kind, not the role name. An item is
 * whitelisted unless the actor holds the FULL-view permission for that item's
 * kind (`emotive_claims.view` / `domace_claims.view`) — the same permissions
 * the service keys ROW scope on. So a `client` (own-customer emotive only) is
 * whitelisted, an operator/viewer/admin (full view) is not, and a hypothetical
 * mixed-scope role gets each kind's correct breadth — no role-name coupling.
 */
/**
 * Which permission grants the FULL row for a kind — this decides, per row of the
 * unified list, whether the caller gets internal fields or the client whitelist.
 * Keyed, not branched: a third kind falling into an `else` would have handed
 * machining rows to anyone holding `domace_claims.view`.
 */
const FULL_VIEW_PERMISSION_BY_KIND: Record<ClaimKind, Permission> = {
  [ClaimKind.Emotive]: 'emotive_claims.view',
  [ClaimKind.Domace]: 'domace_claims.view',
}

function hasFullViewForKind(user: MRSessionUser, kind: ClaimKind): boolean {
  return user.permissions.includes(FULL_VIEW_PERMISSION_BY_KIND[kind])
}

export function createClaimsController(container: Container): {
  list: (c: Context) => Promise<Response>
  categoryCounts: (c: Context) => Promise<Response>
} {
  return {
    list: async (c: Context) => {
      const user = requireUser(c)
      const query = ClaimListQuerySchema.parse(c.req.query())
      const result = await container.claimsService.list(query, toActor(user))
      const items = result.items.map((item) =>
        hasFullViewForKind(user, item.kind) ? item : toClientClaimListItem(item),
      )
      return c.json({ ...result, items })
    },

    categoryCounts: async (c: Context) => {
      const user = requireUser(c)
      return c.json(await container.claimsService.categoryCounts(toActor(user)))
    },
  }
}
