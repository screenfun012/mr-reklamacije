import { render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { MRAuthClientForPermissions } from '../route-guards.js'
import { Can, useHasRole, usePermissions } from '../route-guards.js'

type SessionSnapshot = ReturnType<MRAuthClientForPermissions['useSession']>

function createPermissionsClient(snapshot: SessionSnapshot): MRAuthClientForPermissions {
  return {
    useSession: vi.fn(() => snapshot),
  }
}

describe('usePermissions', () => {
  it('returns empty list during loading', () => {
    const authClient = createPermissionsClient({
      data: undefined,
      isPending: true,
      error: null,
    })

    const { result } = renderHook(() => usePermissions(authClient))

    expect(result.current.list).toEqual([])
    expect(result.current.has('any')).toBe(false)
    expect(result.current.hasAny(['a'])).toBe(false)
    expect(result.current.hasAll(['a'])).toBe(false)
    expect(result.current.isLoading).toBe(true)
  })

  it('returns empty list when no session', () => {
    const authClient = createPermissionsClient({
      data: null,
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => usePermissions(authClient))

    expect(result.current.list).toEqual([])
    expect(result.current.has('x')).toBe(false)
  })

  it('returns permissions from session', () => {
    const authClient = createPermissionsClient({
      data: { user: { permissions: ['users.view', 'users.create'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => usePermissions(authClient))

    expect(result.current.list).toEqual(['users.view', 'users.create'])
  })

  it('returns true from has when permission exists', () => {
    const authClient = createPermissionsClient({
      data: { user: { permissions: ['claims.read'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => usePermissions(authClient))

    expect(result.current.has('claims.read')).toBe(true)
    expect(result.current.has('claims.write')).toBe(false)
  })

  it('returns true from hasAny when any permission matches', () => {
    const authClient = createPermissionsClient({
      data: { user: { permissions: ['a.only'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => usePermissions(authClient))

    expect(result.current.hasAny(['a.only', 'b'])).toBe(true)
  })

  it('returns false from hasAny when no permission matches', () => {
    const authClient = createPermissionsClient({
      data: { user: { permissions: ['only.a'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => usePermissions(authClient))

    expect(result.current.hasAny(['x', 'y'])).toBe(false)
  })

  it('returns true from hasAll when every permission matches', () => {
    const authClient = createPermissionsClient({
      data: { user: { permissions: ['one', 'two', 'three'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => usePermissions(authClient))

    expect(result.current.hasAll(['one', 'three'])).toBe(true)
  })

  it('returns false from hasAll when any permission missing', () => {
    const authClient = createPermissionsClient({
      data: { user: { permissions: ['one', 'two'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => usePermissions(authClient))

    expect(result.current.hasAll(['one', 'two', 'three'])).toBe(false)
  })
})

describe('useHasRole', () => {
  it('returns false when no session', () => {
    const authClient = createPermissionsClient({
      data: null,
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => useHasRole(authClient, 'admin'))

    expect(result.current).toBe(false)
  })

  it('returns true when user has given role string', () => {
    const authClient = createPermissionsClient({
      data: { user: { roles: ['viewer', 'admin'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => useHasRole(authClient, 'admin'))

    expect(result.current).toBe(true)
  })

  it('returns false when user lacks given role string', () => {
    const authClient = createPermissionsClient({
      data: { user: { roles: ['client'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => useHasRole(authClient, 'admin'))

    expect(result.current).toBe(false)
  })

  it('returns true when user has any of the roles in array', () => {
    const authClient = createPermissionsClient({
      data: { user: { roles: ['role-a', 'role-b'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => useHasRole(authClient, ['admin', 'role-b']))

    expect(result.current).toBe(true)
  })

  it('still matches when caller passes explicit single-role array', () => {
    const authClient = createPermissionsClient({
      data: { user: { roles: ['admin'] } },
      isPending: false,
      error: null,
    })

    const { result } = renderHook(() => useHasRole(authClient, ['admin']))

    expect(result.current).toBe(true)
  })
})

describe('Can', () => {
  const clientWithPerms = (permissions: string[]) =>
    createPermissionsClient({
      data: { user: { permissions, roles: [] } },
      isPending: false,
      error: null,
    })

  const clientWithRoles = (roles: string[]) =>
    createPermissionsClient({
      data: { user: { permissions: [], roles } },
      isPending: false,
      error: null,
    })

  it('renders children when permission matches', () => {
    render(
      <Can authClient={clientWithPerms(['users.create'])} permission="users.create">
        <span>Allowed region</span>
      </Can>,
    )

    expect(screen.getByText('Allowed region')).toBeInTheDocument()
  })

  it('renders fallback when permission does not match', () => {
    render(
      <Can
        authClient={clientWithPerms(['users.view'])}
        permission="users.delete"
        fallback={<span>No access</span>}
      >
        <span>Secret</span>
      </Can>,
    )

    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
    expect(screen.getByText('No access')).toBeInTheDocument()
  })

  it('renders nothing when permission does not match and no fallback', () => {
    const { container } = render(
      <Can authClient={clientWithPerms([])} permission="users.delete">
        <span>Invisible child</span>
      </Can>,
    )

    expect(screen.queryByText('Invisible child')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('allows when anyOf matches one permission', () => {
    render(
      <Can authClient={clientWithPerms(['b'])} anyOf={['a', 'b', 'c']}>
        <span>Edit allowed</span>
      </Can>,
    )

    expect(screen.getByText('Edit allowed')).toBeInTheDocument()
  })

  it('requires allOf permissions before rendering', () => {
    render(
      <Can authClient={clientWithPerms(['read', 'write'])} allOf={['read', 'write']}>
        <span>Archive</span>
      </Can>,
    )

    expect(screen.getByText('Archive')).toBeInTheDocument()
  })

  it('does not render when allOf misses one permission', () => {
    const { container } = render(
      <Can authClient={clientWithPerms(['read'])} allOf={['read', 'write']}>
        <span>Incomplete</span>
      </Can>,
    )

    expect(screen.queryByText('Incomplete')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('renders by role prop', () => {
    render(
      <Can authClient={clientWithRoles(['viewer'])} role="viewer">
        <span>Viewer pane</span>
      </Can>,
    )

    expect(screen.getByText('Viewer pane')).toBeInTheDocument()
  })

  it('renders when anyRole matches user roles', () => {
    render(
      <Can authClient={clientWithRoles(['x', 'y'])} anyRole={['a', 'y']}>
        <span>Overlap</span>
      </Can>,
    )

    expect(screen.getByText('Overlap')).toBeInTheDocument()
  })

  it('does not render when anyRole overlaps none', () => {
    const { container } = render(
      <Can authClient={clientWithRoles(['client'])} anyRole={['admin', 'operator']}>
        <span>Denied</span>
      </Can>,
    )

    expect(screen.queryByText('Denied')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })
})
