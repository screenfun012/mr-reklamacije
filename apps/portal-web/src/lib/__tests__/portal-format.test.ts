import { describe, expect, it } from 'vitest'

import {
  companyInitials,
  formatCompanyLabel,
  formatPortalDateEyebrow,
  formatPortalTimeAgo,
} from '../portal-format'

describe('formatPortalDateEyebrow', () => {
  it('writes Serbian in Latin script, never Cyrillic', () => {
    // 2026-08-29 is a Saturday — bare `sr` resolves to Cyrillic and printed „СУБОТА".
    const eyebrow = formatPortalDateEyebrow(new Date(2026, 7, 29), 'sr')
    expect(eyebrow).toContain('SUBOTA')
    expect(eyebrow).not.toMatch(/\p{Script=Cyrillic}/u)
  })
})

describe('formatPortalTimeAgo', () => {
  it('writes Serbian in Latin script, never Cyrillic', () => {
    const now = new Date('2026-08-29T12:00:00Z')
    // `numeric: 'auto'` names the day — in Latin script, not „ПРЕКЈУЧЕ".
    const twoDays = formatPortalTimeAgo('2026-08-27T12:00:00Z', 'sr', now)
    expect(twoDays).toBe('PREKJUČE')
    expect(formatPortalTimeAgo('2026-08-26T12:00:00Z', 'sr', now)).toBe('PRE 3 DANA')
    expect(twoDays).not.toMatch(/\p{Script=Cyrillic}/u)
  })
})

describe('formatCompanyLabel', () => {
  it('shows the single linked firm', () => {
    expect(formatCompanyLabel(['AS Tajka'], 'Nikola Nešović')).toBe('AS Tajka')
  })

  it('shows the first firm plus a count when the account holds several', () => {
    expect(formatCompanyLabel(['AS Tajka', 'Bosch', 'Delphi'], 'Nikola')).toBe('AS Tajka +2')
  })

  it('falls back to the account name when no firm is linked', () => {
    expect(formatCompanyLabel([], 'Nikola Nešović')).toBe('Nikola Nešović')
  })

  it('falls back when the linked firm has a blank name', () => {
    // `firmNames[0] ?? fallback` would return '' here — '' is not nullish.
    expect(formatCompanyLabel(['   '], 'Nikola Nešović')).toBe('Nikola Nešović')
    expect(formatCompanyLabel(['', 'Bosch'], 'Nikola')).toBe('Bosch')
  })

  it('never renders the +N suffix into the avatar initials', () => {
    const names = ['AS Tajka', 'Bosch']
    // The header shows the label, but initials must come from the firm alone —
    // otherwise "AS Tajka +1" would initial as "A+".
    expect(formatCompanyLabel(names, '')).toBe('AS Tajka +1')
    expect(companyInitials(names[0] ?? '')).toBe('AT')
  })
})
