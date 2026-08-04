import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakeRemovedBar } from '../intake-removed-bar.js'
import { intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

const REMOVED = { deletedAt: '2026-07-29T08:00:00.000Z' }

describe('IntakeRemovedBar', () => {
  it('says the order is off the list but still in the database', async () => {
    await renderDetailUi(
      <IntakeRemovedBar order={intakeOrderDetailFixture(REMOVED)} canDelete={false} />,
    )

    expect(screen.queryByText(m.intake_detail_removed_note())).not.toBeNull()
  })

  it('offers the way back only to someone who may take orders off the list', async () => {
    await renderDetailUi(
      <IntakeRemovedBar order={intakeOrderDetailFixture(REMOVED)} canDelete={false} />,
    )

    expect(screen.queryByRole('button', { name: m.intake_detail_restore() })).toBeNull()
  })

  it('offers it to someone who may', async () => {
    await renderDetailUi(<IntakeRemovedBar order={intakeOrderDetailFixture(REMOVED)} canDelete />)

    expect(screen.queryByRole('button', { name: m.intake_detail_restore() })).not.toBeNull()
  })
})
