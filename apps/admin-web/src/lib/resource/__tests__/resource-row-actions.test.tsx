import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ResourceRowActions } from '../resource-row-actions'

const LABELS = {
  editLabel: 'Izmeni',
  deactivateLabel: 'Deaktiviraj',
  activateLabel: 'Aktiviraj',
  onEdit: () => undefined,
  onToggleActive: () => undefined,
}

describe('ResourceRowActions', () => {
  // An icon with no name is a puzzle for whoever opens the screen first. The accessible name is what
  // is asserted, not `title` — a tooltip is invisible to a screen reader and to a keyboard.
  it('names every icon action', () => {
    render(<ResourceRowActions item={{ id: 'a', isActive: true }} {...LABELS} />)

    expect(screen.getByRole('button', { name: 'Izmeni' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deaktiviraj' })).toBeInTheDocument()
  })

  // One control does both jobs, so its name has to follow the row or it lies about what the click
  // will do — the classic toggle mistake of naming a control after a state instead of an action.
  it('names the toggle for what it will DO, not for what the row is', () => {
    render(<ResourceRowActions item={{ id: 'a', isActive: false }} {...LABELS} />)

    expect(screen.getByRole('button', { name: 'Aktiviraj' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deaktiviraj' })).toBeNull()
  })
})
