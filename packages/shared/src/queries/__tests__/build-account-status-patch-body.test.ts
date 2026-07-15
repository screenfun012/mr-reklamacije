import { describe, expect, it } from 'vitest'

import { SYSTEM_ROLE_CLIENT } from '../../constants/roles.js'
import { UserAccountStatus } from '../../enums.js'
import { UserAccountStatusPatchInputSchema } from '../../schemas/user.schema.js'
import { buildAccountStatusPatchBody } from '../users.js'

const CUSTOMER_ID = '99999999-9999-4999-8999-999999999999'

describe('buildAccountStatusPatchBody', () => {
  it('omits customerIds for a non-client role (regression: API rejects it otherwise)', () => {
    const body = buildAccountStatusPatchBody({
      status: UserAccountStatus.Approved,
      roleCode: 'operator',
      customerIds: [],
    })

    expect(body).toEqual({ status: UserAccountStatus.Approved, roleCode: 'operator' })
    expect(body).not.toHaveProperty('customerIds')
    // The produced body must satisfy the server schema.
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })

  it('falls back to least-privilege viewer (never operator) when no role is given', () => {
    const body = buildAccountStatusPatchBody({ status: UserAccountStatus.Approved })

    expect(body).toEqual({ status: UserAccountStatus.Approved, roleCode: 'viewer' })
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })

  it('includes customerIds only for the client role', () => {
    const body = buildAccountStatusPatchBody({
      status: UserAccountStatus.Approved,
      roleCode: SYSTEM_ROLE_CLIENT,
      customerIds: [CUSTOMER_ID],
    })

    expect(body).toEqual({
      status: UserAccountStatus.Approved,
      roleCode: SYSTEM_ROLE_CLIENT,
      customerIds: [CUSTOMER_ID],
    })
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })

  it('sends only status when rejecting', () => {
    const body = buildAccountStatusPatchBody({
      status: UserAccountStatus.Rejected,
      roleCode: 'operator',
      customerIds: [CUSTOMER_ID],
    })

    expect(body).toEqual({ status: UserAccountStatus.Rejected })
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })
})
