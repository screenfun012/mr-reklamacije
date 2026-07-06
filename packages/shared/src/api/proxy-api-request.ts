/**
 * Production `/api/**` forwarding for the web apps' Nitro servers.
 *
 * In dev, Vite's `mr-api-proxy` middleware forwards `/api/**` before routing
 * ever runs; in production there is no Vite, so each app mounts a catch-all
 * `/api/$` server route that calls this. The browser stays same-origin (no
 * CORS, host-only cookies preserved) and the API service never needs to be
 * exposed publicly — on Railway it is reached over the private network via
 * `API_INTERNAL_URL`.
 */

/** Request headers that must not be forwarded to the upstream API. */
const STRIPPED_REQUEST_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  // Force identity encoding so the response body and its headers stay in
  // sync when piped back (fetch would silently decompress gzip otherwise).
  'accept-encoding',
]

/** Response headers owned by this server's transport, not the upstream's. */
const STRIPPED_RESPONSE_HEADERS = ['connection', 'keep-alive', 'transfer-encoding']

const BODYLESS_METHODS = new Set(['GET', 'HEAD'])

function resolveApiOrigin(): string {
  // `||` on purpose: an empty env var means "not configured", fall through.
  const origin =
    process.env['VITE_API_URL'] || process.env['API_INTERNAL_URL'] || 'http://localhost:3000'
  return origin.replace(/\/$/, '')
}

function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers(request.headers)
  for (const name of STRIPPED_REQUEST_HEADERS) {
    headers.delete(name)
  }
  return headers
}

function buildResponseHeaders(upstream: Response): Headers {
  const headers = new Headers()
  upstream.headers.forEach((value, name) => {
    if (STRIPPED_RESPONSE_HEADERS.includes(name.toLowerCase())) return
    if (name.toLowerCase() === 'set-cookie') return
    headers.set(name, value)
  })
  // Headers.forEach folds multiple Set-Cookie values into one — Better-Auth
  // login/2FA sets several cookies at once, so append them individually.
  for (const cookie of upstream.headers.getSetCookie()) {
    headers.append('set-cookie', cookie)
  }
  return headers
}

/** Forwards an incoming `/api/**` request to the API service, streaming both bodies. */
export async function proxyApiRequest(request: Request): Promise<Response> {
  const incoming = new URL(request.url)
  const target = `${resolveApiOrigin()}${incoming.pathname}${incoming.search}`

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: buildForwardHeaders(request),
    // Redirects belong to the browser, not the proxy.
    redirect: 'manual',
  }
  if (!BODYLESS_METHODS.has(request.method)) {
    init.body = request.body
    // Node fetch requires half-duplex for streamed request bodies (uploads).
    init.duplex = 'half'
  }

  const upstream = await fetch(target, init)

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: buildResponseHeaders(upstream),
  })
}
