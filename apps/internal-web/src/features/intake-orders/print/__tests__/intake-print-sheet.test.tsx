import { m } from '@mr/i18n'
import { IntakeDamageType, IntakeVehicleType } from '@mr/shared'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  intakeOrderDetailFixture,
  intakePhotoFixture,
  renderDetailUi,
} from '../../detail/__tests__/render-detail.js'
import { INTAKE_SILHOUETTES } from '../../wizard/intake-silhouettes.js'
import { IntakePrintSheet } from '../intake-print-sheet.js'

describe('IntakePrintSheet', () => {
  it('names the order and the two parties', async () => {
    const order = intakeOrderDetailFixture()

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

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

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(screen.getByTestId('print-check-rezervna')).toHaveTextContent('—')
    expect(screen.getByTestId('print-check-dizalica')).toHaveTextContent('✓')
  })

  it('carries no amendment mark on an order nobody corrected', async () => {
    await renderDetailUi(<IntakePrintSheet order={intakeOrderDetailFixture()} locale="sr" />)

    expect(screen.queryByText(m.intake_print_amended({}, { locale: 'sr' }))).toBeNull()
  })

  it('marks a corrected order neutrally, with when and who', async () => {
    // Neutral by decision ⑩: `amended_at` has no kind, so naming one would print the wrong reason
    // every time a phone number was the thing corrected.
    const order = intakeOrderDetailFixture({
      amendedAt: '2026-07-28T10:00:00.000Z',
      amendedByName: 'Jelena Petrović',
    })

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(screen.getByText(m.intake_print_amended({}, { locale: 'sr' }))).toBeDefined()
    expect(screen.getByText(/Jelena Petrović/)).toBeDefined()
  })

  it('draws both signatures as vector paths, not images', async () => {
    const order = intakeOrderDetailFixture()

    const { container } = await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    const paths = container.querySelectorAll('[data-testid="print-signature"] path')
    expect(paths).toHaveLength(2)
    expect(paths[0]?.getAttribute('d')).toBe(order.technicianSignature)
  })

  it('counts the photos in the legal sentence, because that is what is being signed for', async () => {
    const order = intakeOrderDetailFixture()

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(
      screen.getByText(
        m.intake_print_legal({ count: 0, number: order.orderNumber }, { locale: 'sr' }),
      ),
    ).toBeDefined()
  })

  it('renders in the language it was handed, not the app one', async () => {
    const order = intakeOrderDetailFixture()

    await renderDetailUi(<IntakePrintSheet order={order} locale="en" />)

    expect(screen.getByText(m.intake_print_title({}, { locale: 'en' }))).toBeDefined()
    expect(screen.queryByText(m.intake_print_title({}, { locale: 'sr' }))).toBeNull()
  })
})

describe('IntakePrintSheet — evidence', () => {
  function damage(n: number) {
    return { id: `d${n}`, type: IntakeDamageType.Scratch, x: 100 + n, y: 60 + n, zone: `Zona ${n}` }
  }

  it('draws the silhouette of the order vehicle type, not a car by default', async () => {
    const { container } = await renderDetailUi(
      <IntakePrintSheet
        order={intakeOrderDetailFixture({ vehicleType: IntakeVehicleType.Van })}
        locale="sr"
      />,
    )

    const paths = container.querySelectorAll('[data-testid="print-silhouette"] path')
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]?.getAttribute('d')).toBe(INTAKE_SILHOUETTES[IntakeVehicleType.Van][0]?.d)
  })

  it('puts the same number on the marker, the defect row and the photo badge', async () => {
    const order = intakeOrderDetailFixture({
      damages: [damage(1), damage(2)],
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444', damageId: 'd2' })],
    })

    const { container } = await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(container.querySelector('[data-testid="print-marker-2"]')).not.toBeNull()
    expect(screen.getByTestId('print-damage-2')).toHaveTextContent('Zona 2')
    expect(screen.getByTestId('print-photo-badge')).toHaveTextContent('2')
  })

  it('says there were none rather than leaving the defect list blank', async () => {
    await renderDetailUi(
      <IntakePrintSheet order={intakeOrderDetailFixture({ damages: [] })} locale="sr" />,
    )

    expect(screen.getByText(m.intake_print_no_damage({}, { locale: 'sr' }))).toBeDefined()
  })

  it('says how many defects were left off the page', async () => {
    const order = intakeOrderDetailFixture({
      damages: Array.from({ length: 15 }, (_, i) => damage(i + 1)),
    })

    await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

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

    const { container } = await renderDetailUi(<IntakePrintSheet order={order} locale="sr" />)

    expect(
      container.querySelector('[data-testid="print-marker-1"] circle')?.getAttribute('fill'),
    ).toBe('#ed1c24')
  })
})
