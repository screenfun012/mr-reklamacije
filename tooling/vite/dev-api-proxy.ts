import type { PluginOption, ViteDevServer } from 'vite'
import type * as http from 'node:http'
import {
  createProxyMiddleware,
  debugProxyErrorsPlugin,
  type RequestHandler,
} from 'http-proxy-middleware'

const API_TARGET = 'http://127.0.0.1:3000'
const PROXY_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 200

/** ECONNRESET retry: safe reads only — POST/DELETE retry only on ECONNREFUSED. */
const ECONNRESET_RETRY_METHODS = new Set(['GET', 'HEAD'])

const retryAttemptKey = Symbol('devApiProxyRetryAttempt')

interface RequestWithRetryState extends http.IncomingMessage {
  [retryAttemptKey]?: number
}

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as NodeJS.ErrnoException).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

/** Mirrors http-proxy-middleware status mapping for connection errors. */
function getProxyErrorStatus(errorCode: string | undefined): number {
  if (errorCode && /HPE_INVALID/.test(errorCode)) {
    return 502
  }

  switch (errorCode) {
    case 'ECONNRESET':
    case 'ENOTFOUND':
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
      return 504
    default:
      return 500
  }
}

function sanitizeProxyPath(input: string | undefined): string {
  return input?.replace(/[<>]/g, (char) => encodeURIComponent(char)) ?? ''
}

function sendProxyError(err: unknown, req: http.IncomingMessage, res: http.ServerResponse): void {
  if (res.headersSent) {
    return
  }

  const statusCode = getProxyErrorStatus(getErrorCode(err))
  res.writeHead(statusCode)

  const host = req.headers.host
  const hostLabel = typeof host === 'string' ? host : undefined
  res.end(
    `Error occurred while trying to proxy: ${sanitizeProxyPath(hostLabel)}${sanitizeProxyPath(req.url ?? undefined)}`,
  )
}

function shouldRetryConnectionError(
  err: unknown,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): boolean {
  if (res.headersSent) {
    return false
  }

  const code = getErrorCode(err)
  const method = (req.method ?? 'GET').toUpperCase()

  if (code === 'ECONNREFUSED') {
    return true
  }

  if (code === 'ECONNRESET') {
    return ECONNRESET_RETRY_METHODS.has(method)
  }

  return false
}

/**
 * Dev-only `/api/**` proxy with connection retry during API hot-reload gaps.
 *
 * - ECONNREFUSED: retry all methods (request never reached the API).
 * - ECONNRESET: retry GET/HEAD only (avoids duplicate POST/DELETE).
 * - Never retries HTTP 5xx or after response headers were sent.
 */
export function createDevApiProxyMiddleware(): RequestHandler {
  const proxy = createProxyMiddleware({
    pathFilter: '/api/**',
    target: API_TARGET,
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    ejectPlugins: true,
    plugins: [debugProxyErrorsPlugin],
  })

  const handler = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next?: (err?: unknown) => void,
  ): void => {
    const attempt = (req as RequestWithRetryState)[retryAttemptKey] ?? 0

    const wrappedNext = (err?: unknown): void => {
      if (err && shouldRetryConnectionError(err, req, res) && attempt < MAX_RETRIES) {
        ;(req as RequestWithRetryState)[retryAttemptKey] = attempt + 1
        setTimeout(() => {
          proxy(req, res, wrappedNext)
        }, RETRY_DELAY_MS)
        return
      }

      if (err) {
        sendProxyError(err, req, res)
      }

      next?.(err)
    }

    proxy(req, res, wrappedNext)
  }

  if (typeof proxy.upgrade === 'function') {
    handler.upgrade = proxy.upgrade
  }

  return handler as RequestHandler
}

/**
 * Vite plugin: mount API proxy before TanStack Start SSR (see #2399).
 * All three web apps import this helper — keep behavior identical.
 */
export function devApiProxyPlugin(): PluginOption {
  return {
    name: 'mr-api-proxy',
    enforce: 'pre',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(createDevApiProxyMiddleware())
    },
  }
}
