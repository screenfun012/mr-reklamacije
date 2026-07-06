import { proxyApiRequest } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'

/**
 * Production `/api/**` catch-all: forwards to the API service over the
 * private network (API_INTERNAL_URL). In dev the Vite `mr-api-proxy`
 * middleware intercepts `/api/**` first, so this route never runs there.
 */
const forward = ({ request }: { request: Request }): Promise<Response> => proxyApiRequest(request)

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: forward,
      POST: forward,
      PATCH: forward,
      PUT: forward,
      DELETE: forward,
      HEAD: forward,
      OPTIONS: forward,
    },
  },
})
