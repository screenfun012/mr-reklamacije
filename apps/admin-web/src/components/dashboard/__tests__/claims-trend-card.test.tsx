import { setLocale } from '@mr/i18n'
import type { DashboardChartMonth } from '@mr/shared'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ClaimsTrendCard } from '../claims-trend-card'

function months(count: number): DashboardChartMonth[] {
  return Array.from({ length: count }, (_, index) => ({
    month: `2026-${String(index + 1).padStart(2, '0')}`,
    emotive: index,
    domace: 1,
    total: index + 1,
  }))
}

describe('ClaimsTrendCard', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  // The figures used to hang off the `title` attribute, which the operating system draws a second
  // or two late — Nikola read that as the chart not reacting at all (2026-08-20).
  it('carries the month and both figures in the page, not in a browser tooltip', () => {
    render(<ClaimsTrendCard months={months(3)} />)

    expect(document.querySelector('[title]')).toBeNull()
    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getByRole('img', { name: /Inostrane: 2/ })).toBeInTheDocument()
  })

  // Centred, the outermost hover cards would hang off the ends of the plot.
  it('hangs the first and last hover card from their own edge', () => {
    render(<ClaimsTrendCard months={months(3)} />)

    const cards = screen.getAllByRole('img').map((column) => column.firstElementChild)

    expect(cards[0]?.className).toContain('left-0')
    expect(cards[1]?.className).toContain('-translate-x-1/2')
    expect(cards[2]?.className).toContain('right-0')
  })
})
