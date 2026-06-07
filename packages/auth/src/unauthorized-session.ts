let handlingUnauthorized = false

/**
 * Signs out and redirects to login after a confirmed 401 from an API call.
 * Idempotent — safe to call from multiple query/mutation error handlers.
 */
export function handleUnauthorizedSession(signOut: () => Promise<unknown>): void {
  if (handlingUnauthorized) return

  const g = globalThis as typeof globalThis & {
    window?: { location?: { assign: (url: string) => void } }
  }
  if (typeof g.window === 'undefined') return

  handlingUnauthorized = true

  void signOut().finally(() => {
    g.window?.location?.assign('/login')
  })
}

/** @internal Test-only reset */
export function resetUnauthorizedSessionHandlerForTests(): void {
  handlingUnauthorized = false
}
