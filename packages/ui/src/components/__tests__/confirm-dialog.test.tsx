import { setLocale } from '@mr/i18n'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from '../confirm-dialog.js'

describe('ConfirmDialog', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('renders title, description and confirm label; cancel defaults to the shared label', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Odbij korisnika"
        description="Ova radnja je nepovratna."
        confirmLabel="Odbij"
        onConfirm={() => {}}
      />,
    )

    expect(screen.getByText('Odbij korisnika')).toBeInTheDocument()
    expect(screen.getByText('Ova radnja je nepovratna.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Odbij' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Otkaži' })).toBeInTheDocument()
  })

  it('fires onConfirm on confirm and onOpenChange(false) on cancel', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Naslov"
        confirmLabel="Potvrdi"
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Potvrdi' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Otkaži' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables cancel and marks confirm busy while pending', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Naslov"
        confirmLabel="Potvrdi"
        pending
        onConfirm={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Otkaži' })).toBeDisabled()
    const confirm = screen.getByRole('button', { name: 'Potvrdi' })
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(confirm).toBeDisabled()
  })
})
