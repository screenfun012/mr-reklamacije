import type { Context } from 'hono'

import type { MRSessionUser } from '../auth/session-types.js'
import { clientIpOf } from './client-ip.js'

export interface HttpActorContext {
  actorUserId: string
  actorIp: string | null
  actorUserAgent: string | null
}

export function getActorContext(c: Context, user: MRSessionUser): HttpActorContext {
  return {
    actorUserId: user.id,
    actorIp: clientIpOf(c),
    actorUserAgent: c.req.header('user-agent') ?? null,
  }
}
