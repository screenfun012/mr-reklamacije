import { describe, expect, it } from 'vitest'

import { UserAccountStatus } from '../../enums.js'
import {
  UserAccountStatusPatchInputSchema,
  UserListItemSchema,
  UserRolesReplaceInputSchema,
  UsersListQuerySchema,
} from '../user.schema.js'

describe('UsersListQuerySchema', () => {
  it('accepts optional accountStatus filter', () => {
    const parsed = UsersListQuerySchema.parse({
      accountStatus: UserAccountStatus.Pending,
      limit: '20',
    })

    expect(parsed.accountStatus).toBe(UserAccountStatus.Pending)
    expect(parsed.limit).toBe(20)
  })

  it('defaults limit when omitted', () => {
    const parsed = UsersListQuerySchema.parse({})

    expect(parsed.limit).toBe(50)
    expect(parsed.accountStatus).toBeUndefined()
  })
})

describe('UserListItemSchema', () => {
  it('parses a safe list item without sensitive fields', () => {
    const parsed = UserListItemSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'pera.peric.test@gmail.com',
      name: 'Pera Perić',
      accountStatus: UserAccountStatus.Pending,
      createdAt: '2026-06-25T10:00:00.000Z',
      roles: ['operator'],
    })

    expect(parsed.name).toBe('Pera Perić')
    expect(parsed.createdAt).toBe('2026-06-25T10:00:00.000Z')
    expect(parsed.roles).toEqual(['operator'])
  })
})

describe('UserAccountStatusPatchInputSchema', () => {
  it('accepts approved and rejected transitions', () => {
    expect(UserAccountStatusPatchInputSchema.parse({ status: 'approved' }).status).toBe(
      UserAccountStatus.Approved,
    )
    expect(UserAccountStatusPatchInputSchema.parse({ status: 'rejected' }).status).toBe(
      UserAccountStatus.Rejected,
    )
  })

  it('defaults roleCode to operator when approving without roleCode', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({ status: 'approved' })

    expect(parsed.status).toBe(UserAccountStatus.Approved)
    if (parsed.status === UserAccountStatus.Approved) {
      expect(parsed.roleCode).toBe('operator')
    }
  })

  it('accepts viewer role on approval', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCode: 'viewer',
    })

    expect(parsed).toEqual({ status: UserAccountStatus.Approved, roleCode: 'viewer' })
  })

  it('rejects admin role on approval', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({ status: 'approved', roleCode: 'admin' }),
    ).toThrow()
  })

  it('rejects roleCode on rejection', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({ status: 'rejected', roleCode: 'operator' }),
    ).toThrow(/roleCode is only allowed when approving/)
  })

  it('rejects pending as a patch target', () => {
    expect(() => UserAccountStatusPatchInputSchema.parse({ status: 'pending' })).toThrow()
  })
})

describe('UserRolesReplaceInputSchema', () => {
  it('accepts a non-empty list of system role codes', () => {
    const parsed = UserRolesReplaceInputSchema.parse({ roleCodes: ['operator'] })

    expect(parsed.roleCodes).toEqual(['operator'])
  })

  it('accepts multiple distinct system roles', () => {
    const parsed = UserRolesReplaceInputSchema.parse({
      roleCodes: ['operator', 'viewer'],
    })

    expect(parsed.roleCodes).toEqual(['operator', 'viewer'])
  })

  it('rejects an empty role list', () => {
    expect(() => UserRolesReplaceInputSchema.parse({ roleCodes: [] })).toThrow()
  })

  it('rejects duplicate role codes', () => {
    expect(() =>
      UserRolesReplaceInputSchema.parse({ roleCodes: ['operator', 'operator'] }),
    ).toThrow(/Duplicate role codes/)
  })

  it('rejects unknown role codes', () => {
    expect(() => UserRolesReplaceInputSchema.parse({ roleCodes: ['super_admin'] })).toThrow()
  })
})
