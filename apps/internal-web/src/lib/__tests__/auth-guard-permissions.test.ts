import {
  CLAIMS_LIST_VIEW_PERMISSIONS,
  CLIENT_PERMISSIONS,
  INTERNAL_APP_PERMISSIONS,
  INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS,
  INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS,
  INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS,
} from '@mr/shared'
import { describe, expect, it } from 'vitest'

function opensAnyOf(held: readonly string[], required: readonly string[]): boolean {
  const set = new Set(held)
  return required.some((permission) => set.has(permission))
}

describe('internal-app permission sets', () => {
  it('does not let a portal client open the internal claim screens', () => {
    // The bug: internal-web guarded its claim routes with the API's permission set, which
    // ACCEPTS `view_own_customer` because the portal calls the same endpoints. A client who
    // signed in at internal.mrclaims.live got the internal claim screen with every action
    // hidden and every request answered 403/404 — software that reads as broken.
    expect(opensAnyOf(CLIENT_PERMISSIONS, INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS)).toBe(false)
    expect(opensAnyOf(CLIENT_PERMISSIONS, INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS)).toBe(false)
    expect(opensAnyOf(CLIENT_PERMISSIONS, INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS)).toBe(false)
    expect(opensAnyOf(CLIENT_PERMISSIONS, INTERNAL_APP_PERMISSIONS)).toBe(false)
  })

  it('still lets the API accept a client — the portal calls those same endpoints', () => {
    // The API set must keep accepting own-customer readers; only the internal SCREENS refuse
    // them. If this ever flips, the portal goes dark.
    expect(opensAnyOf(CLIENT_PERMISSIONS, CLAIMS_LIST_VIEW_PERMISSIONS)).toBe(true)
  })

  it('opens the internal app for every internal reader, one module at a time', () => {
    expect(opensAnyOf(['emotive_claims.view'], INTERNAL_APP_PERMISSIONS)).toBe(true)
    expect(opensAnyOf(['domace_claims.view'], INTERNAL_APP_PERMISSIONS)).toBe(true)
    // A serviser: intake only, no claims at all.
    expect(opensAnyOf(['intake_orders.view_own'], INTERNAL_APP_PERMISSIONS)).toBe(true)
    // A "Statistika only" account — the reason this is written in permissions and not in role
    // codes: that role is built in the admin panel and no list in code would know its name.
    expect(opensAnyOf(['statistics.view_overall'], INTERNAL_APP_PERMISSIONS)).toBe(true)
    expect(opensAnyOf(['client_submissions.manage'], INTERNAL_APP_PERMISSIONS)).toBe(true)
  })
})
