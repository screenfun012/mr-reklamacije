import { ClaimKind, KIND_BADGE_CLASSES, KIND_ICON_CLASSES } from '@mr/shared'
import { setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ClaimKindBadge } from '../claim-kind-badge.js'

const KIND_LABELS_SR: Record<(typeof ClaimKind)[keyof typeof ClaimKind], string> = {
  domace: 'Domaća',
  emotive: 'Inostrana',
}

describe('ClaimKindBadge', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  for (const kind of Object.values(ClaimKind)) {
    it(`renders ${kind} label and color classes`, () => {
      render(<ClaimKindBadge kind={kind} />)

      const badge = screen.getByText(KIND_LABELS_SR[kind])
      expect(badge.tagName).toBe('SPAN')
      expect(badge.className).toContain(KIND_BADGE_CLASSES[kind].split(' ')[0])
      expect(badge.className).toContain('rounded-full')
    })

    it(`renders ${kind} icon`, () => {
      const { container } = render(<ClaimKindBadge kind={kind} />)

      const icon = container.querySelector('svg')
      expect(icon).not.toBeNull()
      expect(icon).toHaveClass(KIND_ICON_CLASSES[kind].split(' ')[0] ?? KIND_ICON_CLASSES[kind])
    })
  }
})
