import { OUTCOME_BADGE_CLASSES, ClaimOutcome } from '@mr/shared'
import { setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { OutcomeBadge } from '../outcome-badge.js'

const OUTCOME_LABELS_SR: Record<(typeof ClaimOutcome)[keyof typeof ClaimOutcome], string> = {
  pending: 'U obradi',
  accepted: 'Prihvaćeno',
  rejected: 'Odbijeno',
  archived: 'Arhiva',
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
  }
})
