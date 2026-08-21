export type AuthSessionUser = {
  id?: unknown
  roles?: unknown
  permissions?: unknown
  name?: unknown
  email?: unknown
}

export type AuthSessionPayload = {
  user?: AuthSessionUser | null
}

/** Router-context shape — JSON-serializable fields only (TanStack beforeLoad). */
export type SerializableAuthSession = {
  user: {
    /**
     * Carried so "is this me?" can be answered from the SAME session the server rendered with.
     * Reading it from the live client session instead made screens differ between SSR and
     * hydration, which React answers by re-rendering the whole tree (2026-08-21).
     */
    id: string
    roles: readonly string[]
    permissions: readonly string[]
    name: string
    email: string
  } | null
}

export function toSerializableAuthSession(
  session: AuthSessionPayload | null,
): SerializableAuthSession | null {
  if (!session?.user || typeof session.user !== 'object') {
    return null
  }

  const roles = Array.isArray(session.user.roles)
    ? session.user.roles.filter((r): r is string => typeof r === 'string')
    : []
  const permissions = Array.isArray(session.user.permissions)
    ? session.user.permissions.filter((p): p is string => typeof p === 'string')
    : []

  const id = typeof session.user.id === 'string' ? session.user.id : ''
  const name = typeof session.user.name === 'string' ? session.user.name : ''
  const email = typeof session.user.email === 'string' ? session.user.email : ''

  return { user: { id, roles, permissions, name, email } }
}

function parseClientSessionPayload(raw: unknown): AuthSessionPayload | null {
  if (!raw || typeof raw !== 'object' || !('data' in raw)) {
    return null
  }
  const data = (raw as { data: unknown }).data
  if (data === null || data === undefined) {
    return null
  }
  if (typeof data !== 'object') {
    return null
  }
  return data as AuthSessionPayload
}

/** Normalizes Better-Auth client `{ data }` and direct API `{ user }` shapes. */
export function resolveSessionPayload(raw: unknown): AuthSessionPayload | null {
  const fromClient = parseClientSessionPayload(raw)
  if (fromClient) {
    return fromClient
  }

  if (raw === null || raw === undefined) {
    return null
  }

  if (typeof raw !== 'object' || !('user' in raw)) {
    return null
  }

  const user = (raw as { user?: unknown }).user
  if (user === null || user === undefined || typeof user !== 'object') {
    return null
  }

  return { user: user as AuthSessionUser }
}
