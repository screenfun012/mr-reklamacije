import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../dropdown-menu.js'

describe('DropdownMenu', () => {
  it('does not render menu items when closed', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item one</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.queryByText('Item one')).not.toBeInTheDocument()
  })

  it('opens on trigger click and fires onSelect for items', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Pick me</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    await user.click(screen.getByRole('button', { name: 'Open' }))

    const item = await screen.findByRole('menuitem', { name: 'Pick me' })
    await user.click(item)

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('updates selected radio item when controlled value changes', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [value, setValue] = useState('a')
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
              <DropdownMenuRadioItem value="a">A</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="b">B</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    const itemA = await screen.findByRole('menuitemradio', { name: 'A' })
    const itemB = await screen.findByRole('menuitemradio', { name: 'B' })
    expect(itemA).toHaveAttribute('aria-checked', 'true')
    expect(itemB).toHaveAttribute('aria-checked', 'false')

    await user.click(itemB)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    const itemBAfter = await screen.findByRole('menuitemradio', { name: 'B' })
    expect(itemBAfter).toHaveAttribute('aria-checked', 'true')
  })
})
