import { setLocale } from '@mr/i18n'
import { beforeEach, describe, expect, it } from 'vitest'

import { sectionLabel } from '../admin-topbar'
import { adminNavItems } from '~/config/navigation'

describe('sectionLabel', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  // Data-driven on purpose: the whole reason the bar reads the navigation instead of a hand-written
  // if-chain is that a screen must not be reachable from the sidebar without its name following.
  // A new nav entry joins this assertion by existing.
  it.each(adminNavItems.map((item) => [item.to, item.key]))(
    'names %s from the navigation entry (%s)',
    (to) => {
      const item = adminNavItems.find((candidate) => candidate.to === to)
      expect(sectionLabel(to)).toBe(item?.label())
    },
  )

  it('keeps the dashboard from claiming every child route', () => {
    // '/' prefixes literally every path, so an unguarded prefix match would label the whole app
    // "Kontrolna tabla".
    expect(sectionLabel('/users')).not.toBe(sectionLabel('/'))
    expect(sectionLabel('/settings/roles')).not.toBe(sectionLabel('/'))
  })

  it('names a child route after its section, not the section list', () => {
    expect(sectionLabel('/settings/engine-types/abc')).toBe(sectionLabel('/settings/engine-types'))
  })

  it('names the security screen, which has no sidebar entry', () => {
    expect(sectionLabel('/settings/security')).not.toBe(sectionLabel('/'))
  })

  it('falls back to the dashboard for a path nothing claims', () => {
    expect(sectionLabel('/nema-ovoga')).toBe(sectionLabel('/'))
  })
})
