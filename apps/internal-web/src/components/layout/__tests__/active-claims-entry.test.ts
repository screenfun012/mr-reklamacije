import { describe, expect, it } from 'vitest'

import { activeClaimsEntry } from '../active-claims-entry.js'

describe('activeClaimsEntry', () => {
  it('names the category on its own list route', () => {
    expect(
      activeClaimsEntry({ pathname: '/reklamacije/kategorija/MASINSKA_OBRADA', search: {} }),
    ).toBe('MASINSKA_OBRADA')
  })

  it('names "all" on the plain list, even with an ordinary category FILTER in the URL', () => {
    // A filter is a filter, not a place — otherwise the select would move the menu under you.
    expect(activeClaimsEntry({ pathname: '/reklamacije', search: { categoryCode: 'NOVI' } })).toBe(
      'all',
    )
  })

  it('follows the category a detail or the wizard was opened from', () => {
    expect(
      activeClaimsEntry({
        pathname: '/reklamacije/emotive/abc',
        search: { categoryCode: 'SERVIS' },
      }),
    ).toBe('SERVIS')
    expect(activeClaimsEntry({ pathname: '/reklamacije/nova', search: {} })).toBe('all')
  })

  it('names nothing outside claims', () => {
    expect(activeClaimsEntry({ pathname: '/prijem', search: {} })).toBeNull()
    expect(activeClaimsEntry({ pathname: '/statistika', search: {} })).toBeNull()
  })
})
