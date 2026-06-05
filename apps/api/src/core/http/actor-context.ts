import type { Context } from 'hono'

import type { MRSessionUser } from '../auth/session-types.js'

export interface HttpActorContext {
  actorUserId: string
  actorIp: string | null
  actorUserAgent: string | null
}

export function getActorContext(c: Context, user: MRSessionUser): HttpActorContext {
  return {
    actorUserId: user.id,
    actorIp: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null,
    actorUserAgent: c.req.header('user-agent') ?? null,
  }
}
