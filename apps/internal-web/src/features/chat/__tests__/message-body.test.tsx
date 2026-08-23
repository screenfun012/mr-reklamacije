import { ClaimKind, type MrRegistryExistingClaim } from '@mr/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MessageBody } from '../message-body'

const CLAIM: MrRegistryExistingClaim = {
  kind: ClaimKind.Emotive,
  claimId: '99999999-9999-4999-8999-999999999999',
}

function resolutions(entries: Array<[string, MrRegistryExistingClaim]>) {
  return new Map(entries)
}

describe('MessageBody', () => {
  it('turns a resolved MR number into a chip that opens its claim', async () => {
    const onOpenClaim = vi.fn()
    render(
      <MessageBody
        body="Stigao motor 7167/25 jutros"
        resolutions={resolutions([['7167/25', CLAIM]])}
        onOpenClaim={onOpenClaim}
      />,
    )

    const chip = screen.getByRole('button', { name: '7167/25' })
    await userEvent.click(chip)

    expect(onOpenClaim).toHaveBeenCalledWith(CLAIM)
  })

  it('resolves through the prefix-stripped key when the literal one is unknown', async () => {
    const onOpenClaim = vi.fn()
    render(
      <MessageBody
        body="Vidi MR 7167/25"
        // The registry holds the number as it was typed years ago — without the prefix.
        resolutions={resolutions([['7167/25', CLAIM]])}
        onOpenClaim={onOpenClaim}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'MR 7167/25' }))

    expect(onOpenClaim).toHaveBeenCalledWith(CLAIM)
  })

  it('leaves an unresolved number as plain text', () => {
    render(<MessageBody body="Nema motora 1111/11" resolutions={resolutions([])} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Nema motora 1111/11')).toBeInTheDocument()
  })

  it('keeps the words around the number, and every line break in them', () => {
    const { container } = render(
      <MessageBody
        body={'Prvi red\nStigao motor 7167/25 jutros'}
        resolutions={resolutions([['7167/25', CLAIM]])}
      />,
    )

    // The text is stored raw and linkified at render — nothing may be lost on the way, the line
    // break included: a message typed on two lines that arrives as one is a different message.
    expect(container.textContent).toBe('Prvi red\nStigao motor 7167/25 jutros')
  })

  it('draws the prototype blue chip, and never a button without a handler', () => {
    render(<MessageBody body="Motor 7167/25" resolutions={resolutions([['7167/25', CLAIM]])} />)

    const chip = screen.getByText('7167/25')
    expect(chip.tagName).toBe('SPAN')
    expect(chip).toHaveClass('bg-mri-info-bg')
    expect(chip).toHaveClass('text-mri-info')
  })
})
