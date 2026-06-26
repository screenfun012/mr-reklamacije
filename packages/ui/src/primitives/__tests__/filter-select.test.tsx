import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FilterSelect } from '../filter-select.js'

const OPTIONS = [
  { value: '__all__', label: 'Sve' },
  { value: 'domace', label: 'Domaće' },
  { value: 'emotive', label: 'Emotivne' },
] as const

describe('FilterSelect', () => {
  it('renders trigger with resolved label for current value', () => {
    render(
      <FilterSelect
        value="__all__"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Vrsta"
        onValueChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Vrsta' }).textContent?.trim()).toBe('Sve')
  })

  it('shows placeholder when value is missing from options', () => {
    render(
      <FilterSelect
        value="unknown"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Vrsta"
        onValueChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Vrsta' }).textContent?.trim()).toBe('Sve')
  })

  it('does not duplicate trigger label text', () => {
    render(
      <FilterSelect
        value="__all__"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Vrsta"
        onValueChange={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('combobox', { name: 'Vrsta' })
    expect(trigger.textContent?.trim()).toBe('Sve')
    expect(trigger.textContent).not.toContain('Sve Sve')
  })

  it('renders optional field label', () => {
    render(
      <FilterSelect
        label="Vrsta reklamacije"
        value="domace"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Vrsta"
        onValueChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Vrsta reklamacije')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Vrsta' }).textContent?.trim()).toBe('Domaće')
  })

  it('calls onValueChange when an option is selected', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <FilterSelect
        value="__all__"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Vrsta"
        onValueChange={onValueChange}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Vrsta' }))
    await user.click(screen.getByRole('option', { name: 'Domaće' }))

    expect(onValueChange).toHaveBeenCalledWith('domace')
  })

  it('applies list item hover classes on options', async () => {
    const user = userEvent.setup()

    render(
      <FilterSelect
        value="__all__"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Vrsta"
        onValueChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Vrsta' }))

    const option = screen.getByRole('option', { name: 'Domaće' })
    expect(option.className).toContain('mr-list-item-interactive')
  })
})
