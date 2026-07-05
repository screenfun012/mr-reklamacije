import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'

import type { Container } from '../../core/container.js'

const SSE_HEARTBEAT_MS = 20_000
// Cap connection lifetime so a deactivated / revoked session and stale customer
// links are re-validated on the next (automatic EventSource) reconnect — the
// auth middleware and getUserCustomerIds both run fresh on the new request.
const SSE_MAX_LIFETIME_MS = 30 * 60_000

export function createSseController(container: Container) {
  return {
    streamMe: (c: Context) => {
      const user = c.get('user')!

      return streamSSE(c, async (stream) => {
        // Portal clients listen on their customers' channels — the only claim
        // signals they ever receive are for their own firm's claims.
        const customerIds = await container.dashboardRepository.getUserCustomerIds(user.id)

        const unsubscribe = container.eventBus.subscribeUser(
          user.id,
          user.roles,
          (event) => {
            void stream.writeSSE({
              data: JSON.stringify(event),
              event: event.type,
            })
          },
          customerIds,
        )

        const heartbeat = setInterval(() => {
          if (stream.aborted) {
            return
          }
          void stream.write(':heartbeat\n\n')
        }, SSE_HEARTBEAT_MS)

        // Resolve on client disconnect OR when the lifetime cap elapses; the
        // single teardown below then runs on both paths (no leaked interval or
        // bus subscription).
        await new Promise<void>((resolve) => {
          const lifetime = setTimeout(resolve, SSE_MAX_LIFETIME_MS)
          stream.onAbort(() => {
            clearTimeout(lifetime)
            resolve()
          })
        })

        clearInterval(heartbeat)
        unsubscribe()
      })
    },
  }
}
