import { setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NeedsYouCard } from '../needs-you-card'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}))

describe('NeedsYouCard', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  // An empty queue is GOOD NEWS and has to read that way. A blank panel reads as broken, which is
  // the difference between "nothing is waiting" and "this screen did not load".
  it('says the queue is clear rather than rendering nothing', () => {
    render(<NeedsYouCard pendingUsers={[]} />)

    expect(screen.getByText('Nema naloga na čekanju.')).toBeInTheDocument()
  })

  it('names each waiting person', () => {
    render(<NeedsYouCard pendingUsers={[{ id: '1', name: 'Pera Perić', email: 'pera@test.rs' }]} />)

    expect(screen.getByText('Pera Perić')).toBeInTheDocument()
    expect(screen.getByText('pera@test.rs')).toBeInTheDocument()
  })
})
