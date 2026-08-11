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
   * jsdom performs no layout, so a real overflow can't be reproduced here — this only proves the
   * fixed floor from the V-6-2-style regression (min-w-[200px] fighting a grid column that cannot
   * grow) hasn't crept back in. See the task-5 report for the widths a human must still check in a
   * browser (1180 / 1440 / 430).
   */
  it('sizes the input by percentage, never by a fixed floor', async () => {
    await renderDetailUi(
      <IntakeContactPhone order={intakeOrderDetailFixture({ contactPhone: null })} canUpdate />,
    )

    expect(screen.getByRole('textbox')).toHaveClass('w-full')
    expect(screen.getByRole('textbox')).not.toHaveClass('min-w-[200px]')
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
