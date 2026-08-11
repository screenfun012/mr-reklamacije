import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { INTAKE_CHECKLIST_LABELS } from '../../intake-labels.js'
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

    await renderDetailUi(<TabOverview order={order} canUpdate={false} />)

    expect(screen.getByTestId('condition-rezervna')).toHaveTextContent('—')
    expect(screen.getByTestId('condition-dizalica')).toHaveTextContent('✗')
    expect(screen.getByTestId('condition-komplet')).toHaveTextContent('✓')
    expect(screen.getByText(m.intake_condition_unchecked({ count: 1 }))).toBeDefined()
  })

  it('draws no signature block on an unsigned draft', async () => {
    await renderDetailUi(<TabOverview order={intakeDraftFixture()} canUpdate={false} />)

    // The draft's own tab strip lands here (§4.8), and two empty boxes over "signed and locked"
    // would assert a signature nobody gave.
    expect(screen.queryByText(m.intake_detail_card_signatures())).toBeNull()
    expect(screen.getByText(m.intake_card_condition())).toBeDefined()
  })

  it('says so when there is no damage and no remark, rather than leaving the card blank', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture()} canUpdate={false} />)

    expect(screen.getByText(m.intake_detail_no_damage())).toBeDefined()
    expect(screen.getByText(m.intake_detail_no_remarks())).toBeDefined()
    expect(screen.getByText(m.intake_detail_no_photos())).toBeDefined()
  })

  it('does not report a clean car before anybody has walked around it', async () => {
    // Parked on step 2: damage is step 3, so there is nothing recorded to report. A green 0 and
    // "no damage found" would both be findings nobody made, on a document a customer signs.
    await renderDetailUi(
      <TabOverview order={intakeDraftFixture({ draftStep: 2, fuelLevel: 6 })} canUpdate={false} />,
    )

    expect(screen.queryByText(m.intake_detail_damage_pending())).not.toBeNull()
    expect(screen.queryByText(m.intake_detail_no_damage())).toBeNull()

    // And the numbers, which is where a reader's eye actually lands: no green 0 under NEDOSTACI,
    // because damage is step 3; and no fuel reading, because nothing is signed.
    expect(factValue(m.intake_fact_damages())).toBe(DASH)
    expect(factValue(m.intake_fact_fuel())).toBe(DASH)
    expect(screen.queryByText(m.intake_fact_fuel_value({ level: 6 }))).toBeNull()
  })

  /*
   * The case that separates the two gates. This draft walked every step, so a step gate would
   * happily print its fuel — and `fuel_level` is NOT NULL with a default, so that number may be
   * one nobody ever set. Only the signature makes it a reading. Revert the gate to the step count
   * and this is the single test that goes red.
   */
  it('still withholds the fuel reading on a draft that walked every step but was never signed', async () => {
    await renderDetailUi(
      <TabOverview order={intakeDraftFixture({ draftStep: 5, fuelLevel: 6 })} canUpdate={false} />,
    )

    expect(factValue(m.intake_fact_fuel())).toBe(DASH)
    expect(screen.queryByText(m.intake_fact_fuel_value({ level: 6 }))).toBeNull()
    // The neighbouring cell proves the draft really did get that far — otherwise this test would
    // pass for the boring reason that nothing is recorded at all.
    expect(factValue(m.intake_fact_damages())).toBe('0')
  })

  it('shows those same numbers on a signed intake', async () => {
    await renderDetailUi(
      <TabOverview order={intakeOrderDetailFixture({ fuelLevel: 6 })} canUpdate={false} />,
    )

    expect(factValue(m.intake_fact_damages())).toBe('0')
    expect(screen.queryByText(m.intake_fact_fuel_value({ level: 6 }))).not.toBeNull()
  })

  it('reports a clean car once somebody has', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture()} canUpdate={false} />)

    expect(screen.queryByText(m.intake_detail_no_damage())).not.toBeNull()
    expect(screen.queryByText(m.intake_detail_damage_pending())).toBeNull()
  })

  it('gives the facts grid four even columns, with no cell singled out', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture()} canUpdate={false} />)

    const cell = screen.getByText(m.intake_fact_vin()).parentElement
    expect(cell).toHaveClass('min-w-0')
    expect(cell).not.toHaveClass('col-span-2')
  })

  /*
   * The one deliberate exception to the row above. V-6-2 already lost the last four digits of a
   * phone number to a plain 1/4-width grid cell that could not grow past a control's fixed width,
   * with no scrollbar to hint anything was wrong — this cell spans the row instead of repeating
   * that. jsdom does no layout, so this only proves the class survives, not that the pixels fit;
   * see the task-5 report for the widths (1180 / 1440 / 430) a human still has to check.
   */
  it('spans the owner-phone cell across the row so its added-contact control has room', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture()} canUpdate={false} />)

    const cell = screen.getByText(m.intake_field_owner_phone()).parentElement
    expect(cell).toHaveClass('min-w-0', 'col-span-2', '@min-[860px]:col-span-4')
  })

  // H retired the whole editing mode this tab used to grow (docs/25 §3.0): the checklist grid, the
  // fuel stepper, the equipment-note input and the damage-type picker never render any more, on
  // any order, because nothing can hand this component a buffer to edit.
  it('never renders the retired editing controls', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture()} canUpdate={false} />)

    expect(screen.queryByRole('group', { name: INTAKE_CHECKLIST_LABELS.lanci() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_fuel_more() })).toBeNull()
    expect(screen.queryByLabelText(m.intake_field_equipment_note())).toBeNull()
    expect(screen.queryByRole('group', { name: m.intake_damage_type_pick() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_map_aria() })).toBeNull()
  })
})
