import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DatePicker } from '../date-picker.js'

describe('DatePicker', () => {
  it('shows formatted value for ISO input', () => {
    render(<DatePicker value="2026-04-17" onChange={vi.fn()} aria-label="Date from" />)
    expect(screen.getByRole('button', { name: 'Date from' })).toHaveTextContent('17.04.2026')
  })

  it('shows placeholder when empty', () => {
    render(
      <DatePicker
        value={undefined}
        onChange={vi.fn()}
        placeholder="dd.mm.yyyy"
        aria-label="Date"
      />,
    )
    expect(screen.getByRole('button', { name: 'Date' })).toHaveTextContent('dd.mm.yyyy')
  })

  it('clears value when clear control is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker value="2026-04-17" onChange={onChange} aria-label="Date from" />)

    await user.click(screen.getByRole('button', { name: 'Clear date' }))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})
