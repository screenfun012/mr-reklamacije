import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../sheet.js'

describe('Sheet', () => {
  it('opens panel content when trigger is clicked', async () => {
    const user = userEvent.setup()

    render(
      <Sheet>
        <SheetTrigger>Open panel</SheetTrigger>
        <SheetContent side="right" className="w-[95vw] max-w-[95vw]">
          <SheetHeader>
            <SheetTitle>Izveštaj</SheetTitle>
            <SheetDescription>Editor sadržaj</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    )

    await user.click(screen.getByRole('button', { name: 'Open panel' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Izveštaj')).toBeInTheDocument()
    expect(screen.getByText('Editor sadržaj')).toBeInTheDocument()
  })
})
