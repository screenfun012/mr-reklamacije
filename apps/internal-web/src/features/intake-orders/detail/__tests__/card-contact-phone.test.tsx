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
})
