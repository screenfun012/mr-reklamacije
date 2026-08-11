import { m } from '@mr/i18n'
import { IntakeDetailTab } from '@mr/shared'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakeDetailTabs, visibleIntakeDetailTab } from '../intake-detail-tabs.js'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

describe('visibleIntakeDetailTab', () => {
  it('defaults to Pregled when the URL carries no tab', () => {
    expect(visibleIntakeDetailTab(undefined, '2026-07-27T19:10:00.000Z')).toBe(
      IntakeDetailTab.Pregled,
    )
  })

  it('honours every tab on a signed order', () => {
    expect(visibleIntakeDetailTab(IntakeDetailTab.Istorija, '2026-07-27T19:10:00.000Z')).toBe(
      IntakeDetailTab.Istorija,
    )
  })

  /*
   * A pasted or bookmarked `/prijem/<draft>?tab=istorija` must not leave the screen on a tab
   * the draft does not offer — the same hole `visibleIntakeSearch` closes for `?view=`.
   */
  it('collapses a tab a draft does not offer back to Pregled', () => {
    expect(visibleIntakeDetailTab(IntakeDetailTab.Istorija, null)).toBe(IntakeDetailTab.Pregled)
    expect(visibleIntakeDetailTab(IntakeDetailTab.Spec, null)).toBe(IntakeDetailTab.Pregled)
    expect(visibleIntakeDetailTab(IntakeDetailTab.Fotografije, null)).toBe(
      IntakeDetailTab.Fotografije,
    )
  })
})

describe('IntakeDetailTabs', () => {
  it('draws all four tabs on a signed order, with the photo count', async () => {
    await renderDetailUi(
      <IntakeDetailTabs order={intakeOrderDetailFixture()} activeTab={IntakeDetailTab.Pregled} />,
    )

    expect(screen.queryByRole('link', { name: m.intake_tab_pregled() })).not.toBeNull()
    expect(
      screen.queryByRole('link', { name: m.intake_tab_fotografije({ count: 0 }) }),
    ).not.toBeNull()
    expect(screen.queryByRole('link', { name: m.intake_tab_spec() })).not.toBeNull()
    expect(screen.queryByRole('link', { name: m.intake_tab_istorija() })).not.toBeNull()
  })

  it('draws only Pregled and Fotografije on a draft', async () => {
    await renderDetailUi(
      <IntakeDetailTabs order={intakeDraftFixture()} activeTab={IntakeDetailTab.Pregled} />,
    )

    expect(screen.queryByRole('link', { name: m.intake_tab_pregled() })).not.toBeNull()
    expect(
      screen.queryByRole('link', { name: m.intake_tab_fotografije({ count: 0 }) }),
    ).not.toBeNull()
    expect(screen.queryByRole('link', { name: m.intake_tab_spec() })).toBeNull()
    expect(screen.queryByRole('link', { name: m.intake_tab_istorija() })).toBeNull()
  })
})
