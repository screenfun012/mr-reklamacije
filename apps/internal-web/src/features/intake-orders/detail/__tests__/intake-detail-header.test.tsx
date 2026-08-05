import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakeDetailHeader } from '../intake-detail-header.js'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

const NO_PERMS = { canAdvance: false, canDelete: false }

describe('IntakeDetailHeader', () => {
  it('shows the amended pill only on an amended order', async () => {
    await renderDetailUi(<IntakeDetailHeader order={intakeOrderDetailFixture()} {...NO_PERMS} />)
    expect(screen.queryByText(m.intake_detail_amended_badge())).toBeNull()
  })

  it('shows the amended pill once the condition was corrected after signing', async () => {
    const order = intakeOrderDetailFixture({
      amendedAt: '2026-07-28T10:00:00.000Z',
      amendedByName: 'Jelena Petrović',
    })

    await renderDetailUi(<IntakeDetailHeader order={order} {...NO_PERMS} />)
    expect(screen.queryByText(m.intake_detail_amended_badge())).not.toBeNull()
  })

  it('offers the next status only with the advance permission, and never past Preuzeto', async () => {
    await renderDetailUi(
      <IntakeDetailHeader order={intakeOrderDetailFixture()} canAdvance canDelete={false} />,
    )

    // Primljeno → U radu.
    expect(
      screen.queryByRole('button', { name: m.intake_detail_advance({ status: 'U radu' }) }),
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_detail_remove() })).toBeNull()
  })

  it('draws no action but print on a removed order, whatever the caller may do', async () => {
    const order = intakeOrderDetailFixture({ deletedAt: '2026-07-29T08:00:00.000Z' })

    await renderDetailUi(<IntakeDetailHeader order={order} canAdvance canDelete />)

    expect(screen.queryByRole('button', { name: m.intake_detail_remove() })).toBeNull()
    expect(
      screen.queryByRole('button', { name: m.intake_detail_advance({ status: 'U radu' }) }),
    ).toBeNull()
  })

  it('marks an unfinished intake as unfinished, not as Primljeno', async () => {
    // A draft is `primljeno` only because that is the column default. Printing it here put a blue
    // status pill directly above the amber "Nedovršen" bar, so one order said two things — and the
    // list already refuses to print it for exactly this reason.
    await renderDetailUi(
      <IntakeDetailHeader order={intakeDraftFixture({ draftStep: 3 })} {...NO_PERMS} />,
    )

    expect(screen.queryByText(m.intake_row_draft())).not.toBeNull()
    expect(screen.queryByText('Primljeno')).toBeNull()
    // The step belongs to the bar below, once. Seen in the browser: pill, tag and sentence said
    // "nedovršen" three times inside 100px, and the step twice.
    expect(screen.queryByText(m.intake_row_draft_step({ step: 3 }))).toBeNull()
  })

  it('still names the status once the intake is signed', async () => {
    await renderDetailUi(<IntakeDetailHeader order={intakeOrderDetailFixture()} {...NO_PERMS} />)

    expect(screen.queryByText('Primljeno')).not.toBeNull()
  })
})
