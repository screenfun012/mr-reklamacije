import { describe, expect, it } from 'vitest'

import { companyInitials, formatCompanyLabel } from '../portal-format'

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
