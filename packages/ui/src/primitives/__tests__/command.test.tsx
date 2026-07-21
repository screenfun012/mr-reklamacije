import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../command.js'

function Harness() {
  return (
    <Command shouldFilter>
      <CommandInput placeholder="Search" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Group">
          <CommandItem value="apple">Apple</CommandItem>
          <CommandItem value="banana">Banana</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

describe('Command', () => {
  it('filters items as the user types', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search'), 'app')

    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })
})
