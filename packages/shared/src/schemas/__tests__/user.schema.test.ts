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
      UserAccountStatusPatchInputSchema.parse({ status: 'approved', roleCodes: ['viewer'] }).status,
    ).toBe(UserAccountStatus.Approved)
    expect(UserAccountStatusPatchInputSchema.parse({ status: 'rejected' }).status).toBe(
      UserAccountStatus.Rejected,
    )
  })

  it('rejects approving without a package (no silent operator default)', () => {
    expect(() => UserAccountStatusPatchInputSchema.parse({ status: 'approved' })).toThrow(
      /roleCodes is required when approving/,
    )
  })

  it('rejects approving with an empty package list', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({ status: 'approved', roleCodes: [] }),
    ).toThrow(/roleCodes is required when approving/)
  })

  it('accepts several packages at once, because rights add up', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCodes: ['viewer', 'prijem_kancelarija'],
    })

    expect(parsed).toEqual({
      status: UserAccountStatus.Approved,
      roleCodes: ['viewer', 'prijem_kancelarija'],
      customerIds: [],
    })
  })

  it('dedupes the package list', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCodes: ['viewer', 'viewer'],
    })

    if (parsed.status === UserAccountStatus.Approved) {
      expect(parsed.roleCodes).toEqual(['viewer'])
    }
  })

  it('accepts viewer on approval with empty customerIds', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCodes: ['viewer'],
    })

    expect(parsed).toEqual({
      status: UserAccountStatus.Approved,
      roleCodes: ['viewer'],
      customerIds: [],
    })
  })

  it('accepts the client package with linked customerIds', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCodes: ['client'],
      customerIds: ['99999999-9999-4999-8999-999999999999'],
    })

    expect(parsed).toEqual({
      status: UserAccountStatus.Approved,
      roleCodes: ['client'],
      customerIds: ['99999999-9999-4999-8999-999999999999'],
    })
  })

  /**
   * A portal client is not a colleague with an extra package: the client set is what makes an
   * account see the portal and nothing else, and combined with a staff set the same account would
   * hold internal rights and a firm link at once — a shape no screen was designed for.
   */
  it('refuses the client package beside any other one', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({
        status: 'approved',
        roleCodes: ['client', 'operator'],
        customerIds: ['99999999-9999-4999-8999-999999999999'],
      }),
    ).toThrow(/Klijent se ne može kombinovati/)
  })

  it('dedupes customerIds when approving a client', () => {
    const parsed = UserAccountStatusPatchInputSchema.parse({
      status: 'approved',
      roleCodes: ['client'],
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
      UserAccountStatusPatchInputSchema.parse({ status: 'approved', roleCodes: ['client'] }),
    ).toThrow(/customerIds is required when approving a client/)
  })

  it('rejects client approval with an empty customerIds list', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({
        status: 'approved',
        roleCodes: ['client'],
        customerIds: [],
      }),
    ).toThrow(/customerIds is required when approving a client/)
  })

  it('rejects customerIds for a non-client package', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({
        status: 'approved',
        roleCodes: ['operator'],
        customerIds: ['99999999-9999-4999-8999-999999999999'],
      }),
    ).toThrow(/customerIds is only allowed for the client role/)
  })

  it('rejects the admin package on approval', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({ status: 'approved', roleCodes: ['admin'] }),
    ).toThrow()
  })

  it('rejects packages on rejection', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({ status: 'rejected', roleCodes: ['operator'] }),
    ).toThrow(/roleCodes is only allowed when approving/)
  })

  it('rejects customerIds on rejection', () => {
    expect(() =>
      UserAccountStatusPatchInputSchema.parse({
        status: 'rejected',
        customerIds: ['99999999-9999-4999-8999-999999999999'],
      }),
    ).toThrow(/customerIds is only allowed when approving/)
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
