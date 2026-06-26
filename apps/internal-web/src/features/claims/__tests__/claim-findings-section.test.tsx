import { m, setLocale } from '@mr/i18n'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ClaimFindingsSection } from '../claim-findings-section.js'

describe('ClaimFindingsSection', () => {
  it('shows empty state in read-only mode', () => {
    setLocale('sr')

    render(
      <ClaimFindingsSection
        internalNotes={null}
        canEdit={false}
        isSaving={false}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Nalazi' })).toBeInTheDocument()
    expect(screen.getByText('Nema nalaza.')).toBeInTheDocument()
  })

  it('saves findings via onSave', async () => {
    setLocale('sr')
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ClaimFindingsSection internalNotes="Stari nalaz" canEdit isSaving={false} onSave={onSave} />,
    )

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Novi nalaz' } })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Novi nalaz'))
  })
})
