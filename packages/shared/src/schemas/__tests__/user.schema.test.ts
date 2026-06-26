import { describe, expect, it } from 'vitest'

import { UserAccountStatus } from '../../enums.js'
import {
  UserAccountStatusPatchInputSchema,
  UserListItemSchema,
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

  it('rejects pending as a patch target', () => {
    expect(() => UserAccountStatusPatchInputSchema.parse({ status: 'pending' })).toThrow()
  })
})
