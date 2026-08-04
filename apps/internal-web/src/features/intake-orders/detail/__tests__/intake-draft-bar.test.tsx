import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakeDraftBar } from '../intake-draft-bar.js'
import { intakeDraftFixture, renderDetailUi } from './render-detail.js'

const draft = intakeDraftFixture({ technicianId: '22222222-2222-4222-8222-222222222222' })

describe('IntakeDraftBar', () => {
  it('offers NASTAVI to the serviser whose intake it is', async () => {
    await renderDetailUi(
      <IntakeDraftBar order={draft} currentUserId={draft.technicianId} canDelete={false} />,
    )

    expect(screen.queryByRole('link', { name: m.intake_draft_resume() })).not.toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_action_discard() })).not.toBeNull()
  })

  it('offers nobody else the continue button, not even the office', async () => {
    await renderDetailUi(
      <IntakeDraftBar
        order={draft}
        currentUserId="33333333-3333-4333-8333-333333333333"
        canDelete
      />,
    )

    expect(screen.queryByRole('link', { name: m.intake_draft_resume() })).toBeNull()
    // The office still cleans up after a serviser who left — docs/25 §3.3.5.
    expect(screen.queryByRole('button', { name: m.intake_action_discard() })).not.toBeNull()
  })

  it('offers neither action while the session has not resolved a user id', async () => {
    await renderDetailUi(
      <IntakeDraftBar order={draft} currentUserId={undefined} canDelete={false} />,
    )

    expect(screen.queryByRole('link', { name: m.intake_draft_resume() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_action_discard() })).toBeNull()
  })

  it('names the step the intake stopped at', async () => {
    await renderDetailUi(
      <IntakeDraftBar order={draft} currentUserId={draft.technicianId} canDelete={false} />,
    )

    expect(screen.queryByText(m.intake_detail_draft_step({ step: 3 }))).not.toBeNull()
  })
})
