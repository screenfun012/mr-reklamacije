import { ClaimOutcome, OUTCOME_BADGE_CLASSES } from '@mr/shared'
import { setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { OutcomeBadge } from '../outcome-badge.js'

const OUTCOME_LABELS_SR: Record<(typeof ClaimOutcome)[keyof typeof ClaimOutcome], string> = {
  pending: 'U obradi',
  accepted: 'Prihvaćeno',
  rejected: 'Odbijeno',
  archived: 'Arhivirano',
}

describe('OutcomeBadge', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  for (const outcome of Object.values(ClaimOutcome)) {
    it(`renders ${outcome} label and color classes`, () => {
      render(<OutcomeBadge outcome={outcome} />)

      const badge = screen.getByText(OUTCOME_LABELS_SR[outcome])
      expect(badge.tagName).toBe('SPAN')
      expect(badge.className).toContain(OUTCOME_BADGE_CLASSES[outcome].split(' ')[0])
    })

    it(`renders ${outcome} icon`, () => {
      const { container } = render(<OutcomeBadge outcome={outcome} />)

      expect(container.querySelector('svg')).not.toBeNull()
    })
  }

  it('pulses icon only for pending outcome', () => {
    const { container: pendingContainer } = render(<OutcomeBadge outcome={ClaimOutcome.Pending} />)
    const pendingIcon = pendingContainer.querySelector('svg')
    expect(pendingIcon).toHaveClass('animate-pulse')

    const { container: acceptedContainer } = render(
      <OutcomeBadge outcome={ClaimOutcome.Accepted} />,
    )
    const acceptedIcon = acceptedContainer.querySelector('svg')
    expect(acceptedIcon).not.toHaveClass('animate-pulse')
  })

  it('plays enter animation once when outcome changes', () => {
    const { rerender } = render(<OutcomeBadge outcome={ClaimOutcome.Pending} />)

    rerender(<OutcomeBadge outcome={ClaimOutcome.Accepted} />)

    const badge = screen.getByText('Prihvaćeno')
    expect(badge.className).toContain('animate-fade-in-scale')
  })
})
