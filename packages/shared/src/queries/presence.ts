import { fetchParsed } from '../api/fetch-json.js'
import { fetchNoContent } from '../api/fetch-no-content.js'
import {
  PresenceHeartbeatResponseSchema,
  type PresenceHeartbeatResponse,
  type PresenceTarget,
} from '../schemas/presence.schema.js'

/** Announce presence on a claim; returns everyone else currently viewing it. */
export function sendPresenceHeartbeat(target: PresenceTarget): Promise<PresenceHeartbeatResponse> {
  return fetchParsed('/api/presence/heartbeat', PresenceHeartbeatResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  })
}

/** Leave a claim explicitly (before the stale timeout would drop you). */
export function sendPresenceLeave(target: PresenceTarget): Promise<void> {
  return fetchNoContent('/api/presence/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
    keepalive: true,
  })
}
