/**
 * SSR session lookup for TanStack Start `beforeLoad` guards.
 * Forwards the browser cookie to the API Better-Auth get-session endpoint.
 */
export function createServerSessionLoader(apiOrigin: string): () => Promise<unknown> {
  return async (): Promise<unknown> => {
    try {
      const { getRequestHeaders } = await import('@tanstack/react-start/server')
      const cookie = getRequestHeaders().get('cookie') ?? ''

      const res = await fetch(`${apiOrigin}/api/auth/get-session`, {
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
