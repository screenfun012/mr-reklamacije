import { m, setLocale } from '@mr/i18n'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EngineTypeSearchableSelectField } from '../engine-type-searchable-select-field.js'

const LEGACY_TYPE_ID = '99999999-9999-4999-8999-999999999999'

describe('EngineTypeSearchableSelectField', () => {
  it('shows legacy orphan engine type when manufacturer is empty', () => {
    setLocale('sr')

    render(
      <EngineTypeSearchableSelectField
        id="engineTypeId"
        value={LEGACY_TYPE_ID}
        manufacturerId=""
        disabled={false}
        orphanEngineType={{ id: LEGACY_TYPE_ID, code: 'ENG-1782' }}
        aria-label="Tip motora"
        onValueChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Tip motora' })).toHaveTextContent('ENG-1782')
    expect(screen.getByRole('combobox', { name: 'Tip motora' })).toBeEnabled()
  })

  it('calls onValueChange when orphan-only selection is changed', async () => {
    setLocale('sr')
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <EngineTypeSearchableSelectField
        id="engineTypeId"
        value={LEGACY_TYPE_ID}
        manufacturerId=""
        disabled={false}
        orphanEngineType={{ id: LEGACY_TYPE_ID, code: 'ENG-1782' }}
        aria-label="Tip motora"
        onValueChange={onValueChange}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Tip motora' }))
    await user.click(
      screen.getByRole('option', { name: m.emotive_claims_create_select_placeholder() }),
    )

    expect(onValueChange).toHaveBeenCalledWith('')
  })
})
