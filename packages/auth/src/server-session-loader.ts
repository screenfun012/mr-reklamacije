import { applyForwardedRequestHeaders } from '@mr/shared'

/**
 * SSR session lookup for TanStack Start `beforeLoad` guards.
 * Forwards the browser cookie AND client address to the API Better-Auth
 * get-session endpoint — see `forwardSsrRequestHeaders` for why the address has
 * to be copied by hand on this path.
 *
 * This runs ONLY on the server (it imports `@tanstack/react-start/server`), so
 * the API origin is resolved at RUNTIME from `process.env` — never from
 * `import.meta.env`, which Vite inlines at build time and would freeze to the
 * localhost fallback in production (the SSR check would then hit nothing and
 * log every user out on reload).
 */
function resolveApiOrigin(): string {
  const origin =
    process.env['VITE_API_URL'] || process.env['API_INTERNAL_URL'] || 'http://localhost:3000'
  return origin.replace(/\/$/, '')
}

export function createServerSessionLoader(): () => Promise<unknown> {
  return async (): Promise<unknown> => {
    try {
      // The ambient-request import stays HERE rather than behind a @mr/shared
      // helper: resolved across the package boundary it leaves this module's
      // graph, and forwarding would silently degrade to nothing. Only the header
      // policy is shared.
      const { getRequestHeaders } = await import('@tanstack/react-start/server')
      const headers = new Headers()
      applyForwardedRequestHeaders(headers, getRequestHeaders())

      const res = await fetch(`${resolveApiOrigin()}/api/auth/get-session`, { headers })

      if (!res.ok) {
        return null
      }

      const text = await res.text()
      if (!text || text === 'null') {
        return null
      }

      return JSON.parse(text) as unknown
    } catch {
      // API unreachable during SSR — unauthenticated; public routes must still render.
      return null
    }
  }
}
