import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ListSelect } from '../list-select.js'

const OPTIONS = [
  { value: 'all', label: 'Sve' },
  { value: 'active', label: 'Aktivno' },
] as const

describe('ListSelect', () => {
  it('renders trigger with resolved label', () => {
    render(
      <ListSelect
        value="all"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Status"
        onValueChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Status' }).textContent?.trim()).toBe('Sve')
  })

  it('calls onValueChange when an option is selected', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <ListSelect
        value="all"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Status"
        onValueChange={onValueChange}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    await user.click(screen.getByRole('option', { name: 'Aktivno' }))

    expect(onValueChange).toHaveBeenCalledWith('active')
  })

  it('applies list item hover class on options', async () => {
    const user = userEvent.setup()

    render(
      <ListSelect
        value="all"
        options={OPTIONS}
        placeholder="Sve"
        aria-label="Status"
        onValueChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: 'Status' }))

    const option = screen.getByRole('option', { name: 'Aktivno' })
    expect(option.className).toContain('mr-list-item-interactive')
    expect(option.tagName).toBe('BUTTON')
  })
})
