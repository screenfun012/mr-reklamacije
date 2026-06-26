import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Button } from '../button.js'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip.js'

describe('Tooltip', () => {
  it('shows content on hover when trigger wraps a disabled button', async () => {
    const user = userEvent.setup()

    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex" data-testid="disabled-delete-wrap">
              <Button type="button" disabled aria-label="Obriši">
                ×
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Ne može se obrisati jer se koristi u postojećim podacima.</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )

    await user.hover(screen.getByTestId('disabled-delete-wrap'))

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'Ne može se obrisati jer se koristi u postojećim podacima.',
      )
    })
  })
})
