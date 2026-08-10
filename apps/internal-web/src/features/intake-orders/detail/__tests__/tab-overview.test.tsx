import { m } from '@mr/i18n'
import { IntakeDamageType } from '@mr/shared'
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { INTAKE_CHECKLIST_LABELS, INTAKE_DAMAGE_TYPE_LABELS } from '../../intake-labels.js'
import { TabOverview } from '../tab-overview.js'
import { intakeAmendBufferFrom } from '../use-intake-amend.js'
import {
  intakeDraftFixture,
  intakeOrderDetailFixture,
  intakePhotoFixture,
  renderDetailUi,
} from './render-detail.js'

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
    await renderDetailUi(<TabOverview order={intakeDraftFixture({ draftStep: 5, fuelLevel: 6 })} />)

    expect(factValue(m.intake_fact_fuel())).toBe(DASH)
    expect(screen.queryByText(m.intake_fact_fuel_value({ level: 6 }))).toBeNull()
    // The neighbouring cell proves the draft really did get that far — otherwise this test would
    // pass for the boring reason that nothing is recorded at all.
    expect(factValue(m.intake_fact_damages())).toBe('0')
  })

  it('shows those same numbers on a signed intake', async () => {
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

describe('TabOverview in edit mode', () => {
  function editing(order = intakeOrderDetailFixture(), patch = vi.fn()) {
    return {
      order,
      patch,
      amend: { buffer: intakeAmendBufferFrom(order), patch, phoneValid: true },
    }
  }

  it('turns the condition card into live DA/NE controls', async () => {
    const { order, patch, amend } = editing()

    await renderDetailUi(<TabOverview order={order} amend={amend} />)

    const group = screen.getByRole('group', { name: INTAKE_CHECKLIST_LABELS.lanci() })
    fireEvent.click(within(group).getByText(m.intake_checklist_yes()))

    expect(patch).toHaveBeenCalledWith({ checklist: { ...order.checklist, lanci: true } })
  })

  it('keeps the third state: tapping the active side again clears the row', async () => {
    // The prototype's DA/NE control cannot do this, and without it the office can mark a document
    // "NE" by mistake with no way back — on evidence a customer signed.
    const { order, patch, amend } = editing()

    await renderDetailUi(<TabOverview order={order} amend={amend} />)

    const group = screen.getByRole('group', { name: INTAKE_CHECKLIST_LABELS.dizalica() })
    fireEvent.click(within(group).getByText(m.intake_checklist_yes()))

    expect(patch).toHaveBeenCalledWith({ checklist: { ...order.checklist, dizalica: null } })
  })

  it('edits the equipment note, which the server has allowed since V-6-1', async () => {
    const { order, patch, amend } = editing(intakeOrderDetailFixture({ equipmentNote: null }))

    await renderDetailUi(<TabOverview order={order} amend={amend} />)

    fireEvent.change(screen.getByLabelText(m.intake_field_equipment_note()), {
      target: { value: 'nema ključa za točkove' },
    })

    expect(patch).toHaveBeenCalledWith({ equipmentNote: 'nema ključa za točkove' })
  })

  it('steps the fuel level, and refuses to walk past either end of the gauge', async () => {
    const { order, patch, amend } = editing(intakeOrderDetailFixture({ fuelLevel: 8 }))

    await renderDetailUi(<TabOverview order={order} amend={amend} />)

    fireEvent.click(screen.getByRole('button', { name: m.intake_fuel_more() }))
    expect(patch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: m.intake_fuel_less() }))
    expect(patch).toHaveBeenCalledWith({ fuelLevel: 7 })
  })

  it('edits the phone, and marks it invalid once it is emptied', async () => {
    const { order, patch, amend } = editing()

    await renderDetailUi(<TabOverview order={order} amend={{ ...amend, phoneValid: false }} />)

    const input = screen.getByLabelText(m.intake_field_owner_phone())
    expect(input).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(input, { target: { value: '+381 64 111 2233' } })
    expect(patch).toHaveBeenCalledWith({ ownerPhone: '+381 64 111 2233' })
  })

  it('leaves the read view untouched when no mode is open', async () => {
    await renderDetailUi(<TabOverview order={intakeOrderDetailFixture()} />)

    expect(screen.queryByRole('group', { name: INTAKE_CHECKLIST_LABELS.lanci() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_fuel_more() })).toBeNull()
    expect(screen.queryByLabelText(m.intake_field_equipment_note())).toBeNull()
    expect(screen.queryByRole('group', { name: m.intake_damage_type_pick() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_map_aria() })).toBeNull()
  })

  it('drops a marker of the selected type where the diagram is tapped', async () => {
    const { order, patch, amend } = editing(intakeOrderDetailFixture({ damages: [] }))

    await renderDetailUi(<TabOverview order={order} amend={amend} />)

    fireEvent.click(
      screen.getByRole('button', { name: INTAKE_DAMAGE_TYPE_LABELS[IntakeDamageType.Dent]() }),
    )

    // jsdom has no layout, so every rect is 0×0 — and the map refuses a tap on an unmeasured
    // drawing, because dividing by that width would place the marker at NaN. Measuring it here is
    // what a browser does for free.
    const map = screen.getByRole('button', { name: m.intake_map_aria() })
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 340,
      bottom: 556,
      width: 340,
      height: 556,
      toJSON: () => ({}),
    })
    fireEvent.click(map, { clientX: 170, clientY: 278 })

    const damages = patch.mock.calls[0]?.[0]?.damages
    expect(damages).toHaveLength(1)
    expect(damages[0].type).toBe(IntakeDamageType.Dent)
    expect(damages[0].x).toBeCloseTo(170)
    expect(damages[0].y).toBeCloseTo(278)
    // The server derives the zone again, but the wire schema refuses an empty one, so the screen
    // has to send a real word or the whole save fails in Zod.
    expect(damages[0].zone.length).toBeGreaterThan(0)
  })

  it('removes a defect row without asking, because nothing has left the screen yet', async () => {
    const damage = {
      id: 'd1',
      type: IntakeDamageType.Scratch,
      x: 100,
      y: 60,
      zone: 'Prednja leva',
    }
    const { order, patch, amend } = editing(intakeOrderDetailFixture({ damages: [damage] }))

    await renderDetailUi(<TabOverview order={order} amend={amend} />)

    fireEvent.click(screen.getByRole('button', { name: m.intake_damage_remove() }))

    expect(patch).toHaveBeenCalledWith({ damages: [] })
  })

  it('numbers the photos from the buffer, not from the stored order', async () => {
    // Otherwise the badges keep the numbering from before the edit while the list beside them has
    // already renumbered — two answers to one question, on the same screen.
    const damage = {
      id: 'd1',
      type: IntakeDamageType.Scratch,
      x: 100,
      y: 60,
      zone: 'Prednja leva',
    }
    const order = intakeOrderDetailFixture({
      damages: [damage],
      photos: [intakePhotoFixture({ damageId: 'd1' })],
    })

    const kept = await renderDetailUi(
      <TabOverview
        order={order}
        amend={{ buffer: intakeAmendBufferFrom(order), patch: vi.fn(), phoneValid: true }}
      />,
    )
    const badged = screen.getByRole('button', { name: m.intake_photo_preview() })
    expect(within(badged).queryByText('1')).not.toBeNull()
    kept.unmount()

    await renderDetailUi(
      <TabOverview
        order={order}
        amend={{
          buffer: { ...intakeAmendBufferFrom(order), damages: [] },
          patch: vi.fn(),
          phoneValid: true,
        }}
      />,
    )
    const bare = screen.getByRole('button', { name: m.intake_photo_preview() })
    expect(within(bare).queryByText('1')).toBeNull()
  })
})
