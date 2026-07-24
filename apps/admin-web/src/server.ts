import { paraglideMiddleware } from '@mr/i18n'
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

const handler = createStartHandler(defaultStreamHandler)

/**
 * SSR entry override. Runs every request through Paraglide's request-scoped
 * AsyncLocalStorage so concurrent users never share server locale state. The
 * ORIGINAL request is handed to the handler (TanStack Router does its own URL
 * localisation) — the middleware only installs the per-request locale context.
 */
export default {
  fetch(...args: Parameters<typeof handler>): Promise<Response> {
    const [request] = args
    return paraglideMiddleware(request, () => handler(...args))
  },
}
