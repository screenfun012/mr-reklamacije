import { createFileRoute } from '@tanstack/react-router'

// Dev proxy: catch-all server route that forwards /api/** requests to the
// separate apps/api process (Hono on :3000). TanStack Start intercepts
// routing before Vite's server.proxy middleware, so an explicit server
// file route is required for portal-web on :3003.
//
// Headers are forwarded unchanged — critically the Origin header so
// Better-Auth can validate against its trustedOrigins list (PUBLIC_ORIGINS).
//
// TODO(production): make the target configurable via env; short-circuit when
// running behind edge routing for /api/**.
const API_TARGET = 'http://localhost:3000'

type FetchInitWithDuplex = RequestInit & { duplex?: 'half' }

async function proxy({
  request,
  params,
}: {
  request: Request
  params: { _splat?: string }
}): Promise<Response> {
  const url = new URL(request.url)
  const splat = params._splat ?? ''
  const targetUrl = `${API_TARGET}/api/${splat}${url.search}`

  const headers = new Headers(request.headers)
  headers.delete('host')

  const init: FetchInitWithDuplex = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body !== null) {
    init.body = request.body
    init.duplex = 'half'
  }

  const response = await fetch(targetUrl, init)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      PATCH: proxy,
      DELETE: proxy,
      OPTIONS: proxy,
      HEAD: proxy,
    },
  },
})
