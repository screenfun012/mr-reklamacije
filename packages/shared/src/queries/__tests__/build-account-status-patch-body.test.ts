import { describe, expect, it } from 'vitest'

import { SYSTEM_ROLE_CLIENT } from '../../constants/roles.js'
import { UserAccountStatus } from '../../enums.js'
import { UserAccountStatusPatchInputSchema } from '../../schemas/user.schema.js'
import { buildAccountStatusPatchBody } from '../users.js'

const CUSTOMER_ID = '99999999-9999-4999-8999-999999999999'

describe('buildAccountStatusPatchBody', () => {
  it('omits customerIds for non-client packages (regression: API rejects it otherwise)', () => {
    const body = buildAccountStatusPatchBody({
      status: UserAccountStatus.Approved,
      roleCodes: ['operator'],
      customerIds: [],
    })

    expect(body).toEqual({ status: UserAccountStatus.Approved, roleCodes: ['operator'] })
    expect(body).not.toHaveProperty('customerIds')
    // The produced body must satisfy the server schema.
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })

  it('carries every chosen package, because rights add up', () => {
    const body = buildAccountStatusPatchBody({
      status: UserAccountStatus.Approved,
      roleCodes: ['intake_yard', 'intake_office'],
    })

    expect(body).toEqual({
      status: UserAccountStatus.Approved,
      roleCodes: ['intake_yard', 'intake_office'],
    })
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })

  it('falls back to least-privilege viewer (never operator) when no package is given', () => {
    const body = buildAccountStatusPatchBody({ status: UserAccountStatus.Approved })

    expect(body).toEqual({ status: UserAccountStatus.Approved, roleCodes: ['viewer'] })
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })

  it('includes customerIds only for the client package', () => {
    const body = buildAccountStatusPatchBody({
      status: UserAccountStatus.Approved,
      roleCodes: [SYSTEM_ROLE_CLIENT],
      customerIds: [CUSTOMER_ID],
    })

    expect(body).toEqual({
      status: UserAccountStatus.Approved,
      roleCodes: [SYSTEM_ROLE_CLIENT],
      customerIds: [CUSTOMER_ID],
    })
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })

  /**
   * A portal client is not a colleague with an extra package: the client set is what makes an
   * account see the portal and nothing else, and combined with a staff set the same account would
   * hold internal rights and a firm link at once.
   */
  it('refuses the client package beside any other one', () => {
    const body = buildAccountStatusPatchBody({
      status: UserAccountStatus.Approved,
      roleCodes: [SYSTEM_ROLE_CLIENT, 'operator'],
      customerIds: [CUSTOMER_ID],
    })

    expect(() => UserAccountStatusPatchInputSchema.parse(body)).toThrow()
  })

  it('sends only status when rejecting', () => {
    const body = buildAccountStatusPatchBody({
      status: UserAccountStatus.Rejected,
      roleCodes: ['operator'],
      customerIds: [CUSTOMER_ID],
    })

    expect(body).toEqual({ status: UserAccountStatus.Rejected })
    expect(() => UserAccountStatusPatchInputSchema.parse(body)).not.toThrow()
  })
})
