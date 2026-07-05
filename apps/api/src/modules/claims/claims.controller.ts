import { ClaimKind, toClientClaimListItem } from '@mr/shared'
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
function hasFullViewForKind(user: MRSessionUser, kind: ClaimKind): boolean {
  const permission = kind === ClaimKind.Emotive ? 'emotive_claims.view' : 'domace_claims.view'
  return user.permissions.includes(permission)
}

export function createClaimsController(container: Container) {
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
  }
}
