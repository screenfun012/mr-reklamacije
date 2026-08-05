import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TabOverview } from '../tab-overview.js'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

describe('TabOverview', () => {
  it('reads an unchecked item as unknown, never as "no"', async () => {
    const order = intakeOrderDetailFixture({
      checklist: {
        rezervna: null,
        dizalica: false,
        komplet: true,
        saobracajna: true,
        vozacka: true,
        prvaPomoc: true,
        prsluk: true,
        lanci: true,
      },
    })

    await renderDetailUi(<TabOverview order={order} />)

    expect(screen.getByTestId('condition-rezervna')).toHaveTextContent('—')
    expect(screen.getByTestId('condition-dizalica')).toHaveTextContent('✗')
    expect(screen.getByTestId('condition-komplet')).toHaveTextContent('✓')
    expect(screen.getByText(m.intake_condition_unchecked({ count: 1 }))).toBeDefined()
  })

  it('draws no signature block on an unsigned draft', async () => {
    await renderDetailUi(<TabOverview order={intakeDraftFixture()} />)

    // The draft's own tab strip lands here (§4.8), and two empty boxes over "signed and locked"
    // would assert a signature nobody gave.
    expect(screen.queryByText(m.intake_detail_card_signatures())).toBeNull()
    expect(screen.queryByText(m.intake_signature_note_clean())).toBeNull()
    expect(screen.getByText(m.intake_card_condition())).toBeDefined()
  })

  it('says so when there is no damage and no remark, rather than leaving the card blank', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture()} />)

    expect(screen.getByText(m.intake_detail_no_damage())).toBeDefined()
    expect(screen.getByText(m.intake_detail_no_remarks())).toBeDefined()
    expect(screen.getByText(m.intake_detail_no_photos())).toBeDefined()
  })
})
