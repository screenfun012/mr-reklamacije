import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Dialog, DialogContent, DialogTitle } from '../dialog.js'
import {
  SearchableSelect,
  filterSearchableSelectOptions,
  type SearchableSelectOption,
} from '../searchable-select.js'

const MANUFACTURER_OPTIONS: readonly SearchableSelectOption[] = [
  { value: 'bmw-id', label: 'BMW', keywords: 'BMW' },
  { value: 'mb-id', label: 'Mercedes-Benz', keywords: 'MB' },
  { value: 'alfa-id', label: 'Alfa Romeo', keywords: 'AR' },
]

describe('filterSearchableSelectOptions', () => {
  it('returns all options when search is empty', () => {
    expect(filterSearchableSelectOptions(MANUFACTURER_OPTIONS, '')).toEqual(MANUFACTURER_OPTIONS)
  })

  it('filters by label and keywords', () => {
    expect(filterSearchableSelectOptions(MANUFACTURER_OPTIONS, 'bmw')).toEqual([
      MANUFACTURER_OPTIONS[0],
    ])
    expect(filterSearchableSelectOptions(MANUFACTURER_OPTIONS, 'mb')).toEqual([
      MANUFACTURER_OPTIONS[1],
    ])
  })
})

function DialogSearchableSelectFixture({
  initialValue = '',
}: {
  initialValue?: string
}): React.ReactElement {
  const [value, setValue] = useState(initialValue)

  return (
    <Dialog open>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle className="sr-only">Form</DialogTitle>
        <SearchableSelect
          id="manufacturerId"
          value={value}
          options={MANUFACTURER_OPTIONS}
          placeholder="Izaberite..."
          searchPlaceholder="Pretraži..."
          emptyOptionLabel="Izaberite..."
          noResultsLabel="Nema rezultata"
          aria-label="Proizvođač"
          onValueChange={setValue}
        />
        <p data-testid="selected-value">{value}</p>
      </DialogContent>
    </Dialog>
  )
}

describe('SearchableSelect', () => {
  it('selects an option when rendered inside a dialog', async () => {
    const user = userEvent.setup()
    render(<DialogSearchableSelectFixture />)

    await user.click(screen.getByRole('combobox', { name: 'Proizvođač' }))
    const popover = await screen.findByRole('dialog', { name: undefined })
    await user.click(within(popover).getByRole('button', { name: 'BMW' }))

    expect(screen.getByRole('combobox', { name: 'Proizvođač' })).toHaveTextContent('BMW')
    expect(screen.getByTestId('selected-value')).toHaveTextContent('bmw-id')
  })

  it('filters options while searching inside a dialog', async () => {
    const user = userEvent.setup()
    render(<DialogSearchableSelectFixture />)

    await user.click(screen.getByRole('combobox', { name: 'Proizvođač' }))
    const popover = await screen.findByRole('dialog', { name: undefined })
    const searchInput = within(popover).getByPlaceholderText('Pretraži...')

    fireEvent.change(searchInput, { target: { value: 'BMW' } })

    expect(within(popover).getByRole('button', { name: 'BMW' })).toBeInTheDocument()
    expect(within(popover).queryByRole('button', { name: 'Mercedes-Benz' })).not.toBeInTheDocument()
    expect(within(popover).queryByRole('button', { name: 'Alfa Romeo' })).not.toBeInTheDocument()
  })

  it('shows the selected label for an initial value', () => {
    render(<DialogSearchableSelectFixture initialValue="bmw-id" />)

    expect(screen.getByRole('combobox', { name: 'Proizvođač' })).toHaveTextContent('BMW')
  })

  it('applies list item hover classes on options', async () => {
    const user = userEvent.setup()
    render(<DialogSearchableSelectFixture />)

    await user.click(screen.getByRole('combobox', { name: 'Proizvođač' }))
    const popover = await screen.findByRole('dialog', { name: undefined })
    const option = within(popover).getByRole('button', { name: 'BMW' })

    expect(option.className).toContain('hover:bg-accent')
    expect(option.className).toContain('data-[highlighted]:bg-accent')
  })
})
