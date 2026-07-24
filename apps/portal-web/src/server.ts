import { runWithPortalRequestLocale } from '@mr/i18n'
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

const handler = createStartHandler(defaultStreamHandler)

/**
 * SSR entry override. Runs every request through the portal locale scope
 * (Paraglide's request-scoped AsyncLocalStorage with the portal cookie-only/EN
 * resolution) so concurrent clients never share server locale state and
 * Accept-Language stays ignored, as the portal requires.
 */
export default {
  fetch(...args: Parameters<typeof handler>): Promise<Response> {
    const [request] = args
    return runWithPortalRequestLocale(request, () => handler(...args))
  },
}
