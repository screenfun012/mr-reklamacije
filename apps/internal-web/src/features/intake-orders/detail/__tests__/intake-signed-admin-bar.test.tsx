import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakeSignedAdminBar } from '../intake-signed-admin-bar.js'
import { intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

const signed = intakeOrderDetailFixture()
const archived = intakeOrderDetailFixture({ archivedAt: '2026-08-20T10:00:00.000Z' })

describe('IntakeSignedAdminBar', () => {
  it('says an order is archived, and offers the way back', async () => {
    await renderDetailUi(<IntakeSignedAdminBar order={archived} canArchive canErase={false} />)

    // Until this bar existed, an archived order opened looking exactly like any other one and the
    // only way back was a row icon in a list view most people never found.
    expect(screen.getByText(`⚠ ${m.intake_archived_banner()}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.intake_unarchive_action() })).toBeInTheDocument()
  })

  it('does not offer the way back to someone who may not archive', async () => {
    await renderDetailUi(
      <IntakeSignedAdminBar order={archived} canArchive={false} canErase={false} />,
    )

    expect(screen.getByText(`⚠ ${m.intake_archived_banner()}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.intake_unarchive_action() })).toBeNull()
  })

  it('draws nothing at all on a normal signed order', async () => {
    await renderDetailUi(<IntakeSignedAdminBar order={signed} canArchive canErase={false} />)

    // A bar on every signed order would be noise on the screen the shop uses all day.
    expect(screen.queryByTestId('intake-signed-admin-bar')).toBeNull()
  })

  it('offers the permanent delete only to whoever holds delete_signed', async () => {
    await renderDetailUi(<IntakeSignedAdminBar order={signed} canArchive canErase />)

    expect(screen.getByRole('button', { name: m.intake_erase_action() })).toBeInTheDocument()
  })

  it('keeps the warning in the confirmation, not on the screen every day', async () => {
    await renderDetailUi(<IntakeSignedAdminBar order={signed} canArchive canErase />)

    // The button, and nothing else. A sentence about everything being destroyed, sitting over a
    // perfectly healthy order all day, reads as something being wrong with that order.
    expect(screen.getByRole('button', { name: m.intake_erase_action() })).toBeInTheDocument()
    expect(screen.queryByText(m.intake_erase_description())).toBeNull()
    // The number, because "are you sure" on a screen full of orders is not a question anybody
    // can answer safely.
    expect(m.intake_erase_title({ number: signed.orderNumber })).toContain(signed.orderNumber)
  })
})
