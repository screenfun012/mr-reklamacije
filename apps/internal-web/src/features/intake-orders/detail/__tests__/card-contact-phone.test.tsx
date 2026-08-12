import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakeContactPhone } from '../card-contact-phone'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail'

describe('IntakeContactPhone', () => {
  it('keeps the signed number visible and labelled as the signed one', async () => {
    await renderDetailUi(
      <IntakeContactPhone
        order={intakeOrderDetailFixture({
          ownerPhone: '+381 11 111 111',
          contactPhone: '+381 64 222 222',
        })}
        canUpdate={false}
      />,
    )

    expect(screen.getByText('+381 64 222 222')).toBeInTheDocument()
    // The whole reason this field is allowed to exist: it must never look like a replacement.
    expect(screen.getByText(/\+381 11 111 111/)).toBeInTheDocument()
  })

  it('renders nothing at all on a draft', async () => {
    await renderDetailUi(
      <IntakeContactPhone order={intakeDraftFixture({ contactPhone: null })} canUpdate />,
    )

    // The card is the only thing rendered inside the router shell, so its own text is the probe.
    expect(screen.queryByText(/Broj za kontakt/)).not.toBeInTheDocument()
  })

  it('offers no input without update permission', async () => {
    await renderDetailUi(
      <IntakeContactPhone
        order={intakeOrderDetailFixture({ contactPhone: '+381 64 222 222' })}
        canUpdate={false}
      />,
    )

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  /*
   * jsdom performs no layout, so a real overflow cannot be reproduced here — this pins the INTENT
   * the V-6-2 regression left behind: the input must always be able to shrink, never held open by a
   * floor in pixels that a narrow container cannot argue with.
   *
   * It used to assert `w-full`, which was the implementation rather than the intent, and `w-full`
   * stopped being right the day this control moved out of the facts grid: as wide as the card meant
   * the buttons wrapped onto their own line with SAČUVAJ floating in the middle of nothing. A width
   * with `max-w-full` shrinks exactly as freely; a `min-w-` is what must never come back.
   */
  it('lets the input shrink, and never holds it open with a floor in pixels', async () => {
    await renderDetailUi(
      <IntakeContactPhone order={intakeOrderDetailFixture({ contactPhone: null })} canUpdate />,
    )

    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('max-w-full')
    expect(input.className).not.toMatch(/\bmin-w-/)
  })

  it('gives the buttons a size, so they read as something you can press', async () => {
    // `ghost` carries no sizing of its own; without one passed, SAČUVAJ rendered as bare text and
    // read as a caption (Nikola, 2026-08-12).
    await renderDetailUi(
      <IntakeContactPhone order={intakeOrderDetailFixture({ contactPhone: null })} canUpdate />,
    )

    expect(screen.getByRole('button', { name: m.intake_contact_phone_save() })).toHaveClass(
      'h-10',
      'w-fit',
    )
  })

  it('disables Save once the draft matches what is already stored', async () => {
    await renderDetailUi(
      <IntakeContactPhone
        order={intakeOrderDetailFixture({ contactPhone: '+381 64 222 222' })}
        canUpdate
      />,
    )

    // The server has no no-op guard on this PATCH: an enabled Save on an unchanged value would
    // write a second, meaningless `contact_added` row to Istorija every time it is pressed.
    expect(screen.getByRole('button', { name: m.intake_contact_phone_save() })).toBeDisabled()
  })
})
