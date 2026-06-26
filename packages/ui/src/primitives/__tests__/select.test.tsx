import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select.js'

describe('Select', () => {
  it('renders trigger with selected label', () => {
    render(
      <Select value="pending" onValueChange={vi.fn()}>
        <SelectTrigger aria-label="Outcome">
          <SelectValue placeholder="Pick outcome" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="accepted">Accepted</SelectItem>
        </SelectContent>
      </Select>,
    )

    expect(screen.getByRole('combobox', { name: 'Outcome' })).toBeInTheDocument()
  })

  it('opens listbox on trigger click', async () => {
    const user = userEvent.setup()
    render(
      <Select value="pending" onValueChange={vi.fn()}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="accepted">Accepted</SelectItem>
        </SelectContent>
      </Select>,
    )

    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Accepted' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Accepted' }).tagName).toBe('BUTTON')
  })

  it('applies list item hover class on option buttons', async () => {
    const user = userEvent.setup()
    render(
      <Select value="pending" onValueChange={vi.fn()}>
        <SelectTrigger aria-label="Outcome">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>,
    )

    await user.click(screen.getByRole('combobox', { name: 'Outcome' }))

    const option = screen.getByRole('option', { name: 'Pending' })
    expect(option.className).toContain('mr-list-item-interactive')
  })
})
