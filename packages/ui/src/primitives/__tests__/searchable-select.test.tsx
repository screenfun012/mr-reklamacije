import { fireEvent, render, screen } from '@testing-library/react'
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
    await user.click(await screen.findByRole('option', { name: 'BMW' }))

    expect(screen.getByRole('combobox', { name: 'Proizvođač' })).toHaveTextContent('BMW')
    expect(screen.getByTestId('selected-value')).toHaveTextContent('bmw-id')
  })

  it('filters options while searching inside a dialog', async () => {
    const user = userEvent.setup()
    render(<DialogSearchableSelectFixture />)

    await user.click(screen.getByRole('combobox', { name: 'Proizvođač' }))
    const searchInput = await screen.findByPlaceholderText('Pretraži...')

    fireEvent.change(searchInput, { target: { value: 'BMW' } })

    expect(screen.getByRole('option', { name: 'BMW' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Mercedes-Benz' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Alfa Romeo' })).not.toBeInTheDocument()
  })

  it('shows the selected label for an initial value', () => {
    render(<DialogSearchableSelectFixture initialValue="bmw-id" />)

    expect(screen.getByRole('combobox', { name: 'Proizvođač' })).toHaveTextContent('BMW')
  })

  it('applies list item hover classes on options', async () => {
    const user = userEvent.setup()
    render(<DialogSearchableSelectFixture />)

    await user.click(screen.getByRole('combobox', { name: 'Proizvođač' }))
    const option = await screen.findByRole('option', { name: 'BMW' })

    expect(option.className).toContain('mr-list-item-interactive')
    expect(option.tagName).toBe('BUTTON')
  })
})

describe('SearchableSelect grouping', () => {
  const GROUPED: readonly SearchableSelectOption[] = [
    { value: 'live-a', label: 'Mašinska obrada' },
    { value: 'gone', label: 'Kompresori †', group: 'Ugašene' },
    { value: 'live-b', label: 'Novi delovi' },
  ]

  // Wrapped in a Dialog like the rest of this file: Radix leaves `pointer-events: none` on the
  // body after an open dialog, and content inside one is what stays clickable.
  function GroupedFixture(): React.ReactElement {
    const [value, setValue] = useState('')
    return (
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="sr-only">Form</DialogTitle>
          <SearchableSelect
            value={value}
            options={GROUPED}
            onValueChange={setValue}
            aria-label="Kategorija"
          />
        </DialogContent>
      </Dialog>
    )
  }

  it('keeps ungrouped options first and puts grouped ones under their heading', async () => {
    const user = userEvent.setup()
    render(<GroupedFixture />)

    await user.click(screen.getByRole('combobox', { name: 'Kategorija' }))

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    // Grouped options move to the end regardless of where they sat in the input list, so a
    // retired row can never be mistaken for a live one just by being next to it.
    expect(options).toEqual(['Mašinska obrada', 'Novi delovi', 'Kompresori †'])
    expect(screen.getByText('Ugašene')).toBeInTheDocument()
  })

  it('drops the heading when its options are filtered away', async () => {
    const user = userEvent.setup()
    render(<GroupedFixture />)

    await user.click(screen.getByRole('combobox', { name: 'Kategorija' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delovi' } })

    expect(screen.getByRole('option', { name: 'Novi delovi' })).toBeInTheDocument()
    expect(screen.queryByText('Ugašene')).not.toBeInTheDocument()
  })
})
