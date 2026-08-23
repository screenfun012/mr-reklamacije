import { describe, expect, it } from 'vitest'

import {
  CLAIMS_NAV_OPEN_COOKIE,
  parseInternalUiPrefs,
  SIDEBAR_COLLAPSED_COOKIE,
} from '~/lib/ui-prefs'

/**
 * This one function decides what the SERVER draws — a 240px rail or a 60px one, a menu of five
 * entries or of one. Get it wrong and the browser corrects it after the first paint, which is the
 * whole defect these cookies exist to remove.
 */
describe('parseInternalUiPrefs', () => {
  it('falls back to the shape a first-time visitor should see', () => {
    expect(parseInternalUiPrefs('')).toEqual({ sidebarCollapsed: false, claimsNavOpen: true })
  })

  it('reads what was chosen', () => {
    expect(
      parseInternalUiPrefs(`${SIDEBAR_COLLAPSED_COOKIE}=1; ${CLAIMS_NAV_OPEN_COOKIE}=0`),
    ).toEqual({ sidebarCollapsed: true, claimsNavOpen: false })
  })

  it('finds a cookie that is not the first one', () => {
    expect(
      parseInternalUiPrefs(`locale=sr; theme=dark; ${SIDEBAR_COLLAPSED_COOKIE}=1`).sidebarCollapsed,
    ).toBe(true)
  })

  /**
   * ⚠ The name has to match WHOLE. A substring match would let any cookie ending in our name
   * decide the layout — including a session cookie some other tool sets — and the failure would
   * look like the rail closing itself for one person and nobody being able to reproduce it.
   */
  it('does not answer to a cookie whose name merely ends with ours', () => {
    expect(parseInternalUiPrefs(`not_${SIDEBAR_COLLAPSED_COOKIE}=1`).sidebarCollapsed).toBe(false)
    expect(parseInternalUiPrefs(`not_${CLAIMS_NAV_OPEN_COOKIE}=0`).claimsNavOpen).toBe(true)
  })

  /** Anything but `1`/`0` means "never chosen" — a half-written cookie must not fold the menu. */
  it('ignores a value it did not write', () => {
    expect(parseInternalUiPrefs(`${CLAIMS_NAV_OPEN_COOKIE}=maybe`).claimsNavOpen).toBe(true)
    expect(parseInternalUiPrefs(`${SIDEBAR_COLLAPSED_COOKIE}=true`).sidebarCollapsed).toBe(false)
  })
})
