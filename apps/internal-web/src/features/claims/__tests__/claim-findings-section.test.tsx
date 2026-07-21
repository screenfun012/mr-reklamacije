import { m, setLocale } from '@mr/i18n'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ClaimFindingsSection } from '../claim-findings-section.js'

describe('ClaimFindingsSection', () => {
  it('shows empty state in read-only mode', () => {
    setLocale('sr')

    render(<ClaimFindingsSection findings={[]} canEdit={false} isSaving={false} onSave={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Nalazi' })).toBeInTheDocument()
    expect(screen.getByText('Nema nalaza.')).toBeInTheDocument()
  })

  it('lists every finding with its type in read-only mode', () => {
    setLocale('sr')

    render(
      <ClaimFindingsSection
        findings={[
          { text: 'Ogrebotina na glavi', type: 'mehanika' },
          { text: 'Curenje ulja', type: '' },
        ]}
        canEdit={false}
        isSaving={false}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByText('Ogrebotina na glavi')).toBeInTheDocument()
    expect(screen.getByText('mehanika')).toBeInTheDocument()
    expect(screen.getByText('Curenje ulja')).toBeInTheDocument()
  })

  it('adds a row and saves the whole list', async () => {
    setLocale('sr')
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ClaimFindingsSection
        findings={[{ text: 'Stari nalaz', type: 'mehanika' }]}
        canEdit
        isSaving={false}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.claims_findings_add() }))
    fireEvent.change(screen.getAllByLabelText(m.claims_findings_text())[1]!, {
      target: { value: 'Novi nalaz' },
    })
    fireEvent.change(screen.getAllByLabelText(m.claims_findings_type())[1]!, {
      target: { value: 'elektrika' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { text: 'Stari nalaz', type: 'mehanika' },
        { text: 'Novi nalaz', type: 'elektrika' },
      ]),
    )
  })

  it('removes a row and drops blank rows on save', async () => {
    setLocale('sr')
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ClaimFindingsSection
        findings={[
          { text: 'Prvi', type: '' },
          { text: 'Drugi', type: '' },
        ]}
        canEdit
        isSaving={false}
        onSave={onSave}
      />,
    )

    fireEvent.change(screen.getAllByLabelText(m.claims_findings_text())[1]!, {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: m.emotive_claims_detail_basic_save() }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ text: 'Prvi', type: '' }]))
  })

  it('does not reset the draft while a save is in progress', () => {
    setLocale('sr')
    const findings = [{ text: 'Stari nalaz', type: '' }]

    const { rerender } = render(
      <ClaimFindingsSection findings={findings} canEdit isSaving={false} onSave={vi.fn()} />,
    )

    fireEvent.change(screen.getAllByLabelText(m.claims_findings_text())[0]!, {
      target: { value: 'Novi nalaz' },
    })

    rerender(<ClaimFindingsSection findings={findings} canEdit isSaving onSave={vi.fn()} />)

    expect(screen.getAllByLabelText(m.claims_findings_text())[0]!).toHaveValue('Novi nalaz')
  })
})
