import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TabOverview } from '../tab-overview.js'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

const DASH = '—'

/** The value rendered under a fact's label — they sit as two children of one cell. */
function factValue(label: string): string {
  const cell = screen.getByText(label).parentElement
  return (cell?.textContent ?? '').replace(label, '').trim()
}

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

  it('does not report a clean car before anybody has walked around it', async () => {
    // Parked on step 2: damage is step 3, so there is nothing recorded to report. A green 0 and
    // "no damage found" would both be findings nobody made, on a document a customer signs.
    await renderDetailUi(<TabOverview order={intakeDraftFixture({ draftStep: 2, fuelLevel: 6 })} />)

    expect(screen.queryByText(m.intake_detail_damage_pending())).not.toBeNull()
    expect(screen.queryByText(m.intake_detail_no_damage())).toBeNull()

    // And the numbers, which is where a reader's eye actually lands: no green 0 under NEDOSTACI,
    // and no fuel reading for a tank nobody looked at. Both are step-2/3 facts on a step-2 draft.
    expect(factValue(m.intake_fact_damages())).toBe(DASH)
    expect(factValue(m.intake_fact_fuel())).toBe(DASH)
    expect(screen.queryByText(m.intake_fact_fuel_value({ level: 6 }))).toBeNull()
  })

  it('shows those same numbers once the intake has been through both steps', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture({ fuelLevel: 6 })} />)

    expect(factValue(m.intake_fact_damages())).toBe('0')
    expect(screen.queryByText(m.intake_fact_fuel_value({ level: 6 }))).not.toBeNull()
  })

  it('reports a clean car once somebody has', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture()} />)

    expect(screen.queryByText(m.intake_detail_no_damage())).not.toBeNull()
    expect(screen.queryByText(m.intake_detail_damage_pending())).toBeNull()
  })

  it('names who corrected the condition after the customer signed, and when', async () => {
    // The highest-stakes sentence on the screen: it says the paper the customer holds no longer
    // matches this record.
    await renderDetailUi(
      <TabOverview
        order={intakeOrderDetailFixture({
          amendedAt: '2026-07-28T10:00:00.000Z',
          amendedByName: 'Jelena Petrović',
        })}
      />,
    )

    expect(screen.queryByText(/Jelena Petrović/)).not.toBeNull()
    expect(screen.queryByText(/28\.07\.2026/)).not.toBeNull()
  })

  it('still says the record was corrected when the name is gone', async () => {
    await renderDetailUi(
      <TabOverview
        order={intakeOrderDetailFixture({
          amendedAt: '2026-07-28T10:00:00.000Z',
          amendedByName: null,
        })}
      />,
    )

    expect(screen.queryByText(new RegExp(m.intake_detail_amended_by_unknown()))).not.toBeNull()
  })
})
