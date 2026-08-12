import { m } from '@mr/i18n'
import { IntakeDamageType, IntakeVehicleType, type IntakeOrderDetail } from '@mr/shared'
import { screen, type RenderResult } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  intakeChecklistCatalogFixture,
  intakeOrderDetailFixture,
  intakePhotoFixture,
  renderDetailUi,
} from '../../detail/__tests__/render-detail.js'
import { INTAKE_SILHOUETTES } from '../../wizard/intake-silhouettes.js'
import type { IntakePrintLocale } from '../intake-print-data.js'
import { IntakePrintSheet } from '../intake-print-sheet.js'

/**
 * The catalog travels as a prop, not as a hook: the sheet is a pure render of paper and the dialog
 * is what fetches (its own test covers that it fetches the DISPLAY read).
 */
function renderSheet(
  order: IntakeOrderDetail,
  locale: IntakePrintLocale = 'sr',
): Promise<RenderResult> {
  return renderDetailUi(
    <IntakePrintSheet
      order={order}
      checklistItems={intakeChecklistCatalogFixture()}
      locale={locale}
    />,
  )
}

describe('IntakePrintSheet', () => {
  it('names the order and the two parties', async () => {
    const order = intakeOrderDetailFixture()

    await renderSheet(order)

    expect(screen.getByText(order.orderNumber)).toBeDefined()
    expect(screen.getAllByText(order.ownerName).length).toBeGreaterThan(0)
    expect(screen.getByText(order.technicianName)).toBeDefined()
    expect(screen.getByText(m.intake_print_title({}, { locale: 'sr' }))).toBeDefined()
  })

  it('prints an unchecked equipment row as a dash', async () => {
    const order = intakeOrderDetailFixture({
      checklist: {
        rezervna: null,
        dizalica: true,
        komplet: true,
        saobracajna: true,
        vozacka: true,
        prvaPomoc: true,
        prsluk: true,
        lanci: true,
      },
    })

    await renderSheet(order)

    expect(screen.getByTestId('print-check-rezervna')).toHaveTextContent('—')
    expect(screen.getByTestId('print-check-dizalica')).toHaveTextContent('✓')
  })

  /**
   * Reachable when the catalog was still empty at the moment the order was taken. The band used to
   * print with nothing under it — a heading over a void on the document the customer signs.
   */
  it('says the checklist was not filled in rather than banding an empty space', async () => {
    await renderSheet(intakeOrderDetailFixture({ checklist: {} }))

    expect(screen.getByText(m.intake_print_section_condition({}, { locale: 'sr' }))).toBeDefined()
    expect(screen.getByText(m.intake_print_condition_empty({}, { locale: 'sr' }))).toBeDefined()
  })

  it('keeps the empty line off the paper when there are rows to print', async () => {
    await renderSheet(intakeOrderDetailFixture())

    expect(screen.queryByText(m.intake_print_condition_empty({}, { locale: 'sr' }))).toBeNull()
  })

  it('prints the equipment note inside the condition band', async () => {
    await renderSheet(intakeOrderDetailFixture({ equipmentNote: 'Gepek pun alata' }))

    expect(screen.getByText('Gepek pun alata')).toBeDefined()
  })

  it('drops the empty-checklist line once a note says something instead', async () => {
    // The note alone satisfies the recording rule, so a sheet carrying one is not an unrecorded
    // intake — saying it was would call the serviser a liar on the customer's own copy.
    await renderSheet(intakeOrderDetailFixture({ checklist: {}, equipmentNote: 'Gepek pun alata' }))

    expect(screen.queryByText(m.intake_print_condition_empty({}, { locale: 'sr' }))).toBeNull()
    expect(screen.getByText('Gepek pun alata')).toBeDefined()
  })

  it('draws both signatures as vector paths, not images', async () => {
    const order = intakeOrderDetailFixture()

    const { container } = await renderSheet(order)

    const paths = container.querySelectorAll('[data-testid="print-signature"] path')
    expect(paths).toHaveLength(2)
    expect(paths[0]?.getAttribute('d')).toBe(order.technicianSignature)
  })

  it('counts the photos in the legal sentence, because that is what is being signed for', async () => {
    const order = intakeOrderDetailFixture()

    await renderSheet(order)

    expect(
      screen.getByText(
        m.intake_print_legal({ count: 0, number: order.orderNumber }, { locale: 'sr' }),
      ),
    ).toBeDefined()
  })

  it('renders in the language it was handed, not the app one', async () => {
    const order = intakeOrderDetailFixture()

    await renderSheet(order, 'en')

    expect(screen.getByText(m.intake_print_title({}, { locale: 'en' }))).toBeDefined()
    expect(screen.queryByText(m.intake_print_title({}, { locale: 'sr' }))).toBeNull()
  })
})

describe('IntakePrintSheet — evidence', () => {
  function damage(n: number) {
    return { id: `d${n}`, type: IntakeDamageType.Scratch, x: 100 + n, y: 60 + n, zone: `Zona ${n}` }
  }

  it('draws the silhouette of the order vehicle type, not a car by default', async () => {
    const { container } = await renderSheet(
      intakeOrderDetailFixture({ vehicleType: IntakeVehicleType.Van }),
    )

    const paths = container.querySelectorAll('[data-testid="print-silhouette"] path')
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.getAttribute('d')).toBe(INTAKE_SILHOUETTES[IntakeVehicleType.Van][0]?.d)
  })

  it('puts the same number on the marker and on the defect row', async () => {
    const order = intakeOrderDetailFixture({
      damages: [damage(1), damage(2)],
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444', damageId: 'd2' })],
    })

    const { container } = await renderSheet(order)

    expect(container.querySelector('[data-testid="print-marker-2"]')).not.toBeNull()
    expect(screen.getByTestId('print-damage-2')).toHaveTextContent('Zona 2')
  })

  it('says there were none rather than leaving the defect list blank', async () => {
    await renderSheet(intakeOrderDetailFixture({ damages: [] }))

    expect(screen.getByText(m.intake_print_no_damage({}, { locale: 'sr' }))).toBeDefined()
  })

  it('says how many defects were left off the page', async () => {
    const order = intakeOrderDetailFixture({
      damages: Array.from({ length: 15 }, (_, i) => damage(i + 1)),
    })

    await renderSheet(order)

    expect(
      screen.getByText(
        m.intake_print_damages_more({ count: 3, number: order.orderNumber }, { locale: 'sr' }),
      ),
    ).toBeDefined()
  })

  it('prints all markers red, whatever the defect type', async () => {
    // Amber and grey do not print legibly — the screen's colour map is deliberately not reused.
    const order = intakeOrderDetailFixture({
      damages: [{ ...damage(1), type: IntakeDamageType.Rust }],
    })

    const { container } = await renderSheet(order)

    expect(
      container.querySelector('[data-testid="print-marker-1"] circle')?.getAttribute('fill'),
    ).toBe('#ed1c24')
  })
})

describe('IntakePrintSheet — the one-page rule', () => {
  function damage(n: number) {
    return { id: `d${n}`, type: IntakeDamageType.Scratch, x: 100 + n, y: 60 + n, zone: `Zona ${n}` }
  }

  /*
   * jsdom has no layout, so this pins the DECISION, not the pixels. Measured in a real browser
   * 2026-08-10: a defect row is 30px and twelve in ONE column push the sheet to 1247px against a
   * fixed 1123 — the footer with both signatures walks onto a second page. Two columns fit twelve.
   */
  it('flows a long defect list in two columns, so twelve of them still fit on one page', async () => {
    const order = intakeOrderDetailFixture({
      damages: Array.from({ length: 12 }, (_, i) => damage(i + 1)),
    })

    await renderSheet(order)

    expect(screen.getByTestId('print-damage-1').parentElement).toHaveClass('columns-2')
  })

  it('keeps a short list in one column, where it reads better', async () => {
    const order = intakeOrderDetailFixture({ damages: [damage(1), damage(2)] })

    await renderSheet(order)

    expect(screen.getByTestId('print-damage-1').parentElement).not.toHaveClass('columns-2')
  })
})
