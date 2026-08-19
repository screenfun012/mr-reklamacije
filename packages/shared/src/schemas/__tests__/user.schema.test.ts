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
      requestedCompany: null,
      isActive: true,
    })

    expect(parsed.name).toBe('Pera Perić')
    expect(parsed.createdAt).toBe('2026-06-25T10:00:00.000Z')
    expect(parsed.roles).toEqual(['operator'])
    expect(parsed.requestedCompany).toBeNull()
    expect(parsed.isActive).toBe(true)
  })
})

describe('UserAccountStatusPatchInputSchema', () => {
  it('accepts approved and rejected transitions', () => {
    expect(
      UserAccountStatusPatchInputSchema.parse({ status: 'approved', roleCode: 'viewer' }).status,
    ).toBe(UserAccountStatus.Approved)
    expect(UserAccountStatusPatchInputSchema.parse({ status: 'rejected' }).status).toBe(
      UserAccountStatus.Rejected,
    )
  })

  it('rejects approving without a roleCode (no silent operator default)', () => {
    expect(() => UserAccountStatusPatchInputSchema.parse({ status: 'approved' })).toThrow(
      /roleCode is required when approving/,
    )
  })

  it('accepts viewer role on approval with empty customerIds', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCode: 'viewer',
    })

    expect(parsed).toEqual({
      status: UserAccountStatus.Approved,
      roleCode: 'viewer',
      customerIds: [],
    })
  })

  it('accepts client role with linked customerIds', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCode: 'client',
      customerIds: ['99999999-9999-4999-8999-999999999999'],
    })

    expect(parsed).toEqual({
      status: UserAccountStatus.Approved,
      roleCode: 'client',
      customerIds: ['99999999-9999-4999-8999-999999999999'],
    })
  })

  it('dedupes customerIds when approving a client', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCode: 'client',
      customerIds: [
        '99999999-9999-4999-8999-999999999999',
        '99999999-9999-4999-8999-999999999999',
        '88888888-8888-4888-8888-888888888888',
      ],
    })

    if (parsed.status === UserAccountStatus.Approved) {
      expect(parsed.customerIds).toEqual([
        '99999999-9999-4999-8999-999999999999',
        '88888888-8888-4888-8888-888888888888',
      ])
    }
  })

  it('rejects client approval without customerIds', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({ status: 'approved', roleCode: 'client' }),
    ).toThrow(/customerIds is required when approving a client/)
  })

  it('rejects client approval with an empty customerIds list', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({
        status: 'approved',
        roleCode: 'client',
        customerIds: [],
      }),
    ).toThrow(/customerIds is required when approving a client/)
  })

  it('rejects customerIds for a non-client role', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({
        status: 'approved',
        roleCode: 'operator',
        customerIds: ['99999999-9999-4999-8999-999999999999'],
      }),
    ).toThrow(/customerIds is only allowed for the client role/)
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

  it('rejects customerIds on rejection', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({
        status: 'rejected',
        customerIds: ['99999999-9999-4999-8999-999999999999'],
      }),
    ).toThrow(/customerIds is only allowed when approving/)
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

  /**
   * This asserted the opposite until R-6, when assignment stopped reading a list in code. A set is
   * built in the panel now, so which codes EXIST is a question only the database can answer — the
   * boundary checks the shape and `UsersRepository.replaceRoles` refuses a code that names nothing
   * (integration-tested, both halves).
   */
  it('accepts a well-shaped code it has never heard of', () => {
    expect(() =>
      UserRolesReplaceInputSchema.parse({ roleCodes: ['prijem_kancelarija'] }),
    ).not.toThrow()
  })

  it('rejects a code that is not code-shaped', () => {
    for (const bad of ['NE VALJA', 'sa razmakom', 'Veliko', '_vodeci', 'trailing_', 'ćirilica']) {
      expect(() => UserRolesReplaceInputSchema.parse({ roleCodes: [bad] })).toThrow()
    }
  })

  it('rejects a code longer than the generator can produce', () => {
    expect(() => UserRolesReplaceInputSchema.parse({ roleCodes: ['a'.repeat(41)] })).toThrow()
  })
})
