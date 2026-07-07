/**
 * SSR session lookup for TanStack Start `beforeLoad` guards.
 * Forwards the browser cookie to the API Better-Auth get-session endpoint.
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
      const { getRequestHeaders } = await import('@tanstack/react-start/server')
      const cookie = getRequestHeaders().get('cookie') ?? ''

      const res = await fetch(`${resolveApiOrigin()}/api/auth/get-session`, {
        headers: cookie ? { cookie } : {},
      })

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
