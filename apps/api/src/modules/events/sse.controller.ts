import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'

import type { Container } from '../../core/container.js'

const SSE_HEARTBEAT_MS = 20_000

export function createSseController(container: Container) {
  return {
    streamMe: (c: Context) => {
      const user = c.get('user')!

      return streamSSE(c, async (stream) => {
        const unsubscribe = container.eventBus.subscribeUser(user.id, user.roles, (event) => {
          void stream.writeSSE({
            data: JSON.stringify(event),
            event: event.type,
          })
        })

        const heartbeat = setInterval(() => {
          if (stream.aborted) {
            return
          }
          void stream.write(':heartbeat\n\n')
        }, SSE_HEARTBEAT_MS)

        stream.onAbort(() => {
          clearInterval(heartbeat)
          unsubscribe()
        })

        await new Promise<void>((resolve) => {
          stream.onAbort(() => resolve())
        })
      })
    },
  }
}
