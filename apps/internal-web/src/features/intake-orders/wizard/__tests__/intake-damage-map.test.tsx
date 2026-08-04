import { m, setLocale } from '@mr/i18n'
import { IntakeDamageType, IntakeVehicleType, type IntakeDamage } from '@mr/shared'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { IntakeDamageMap } from '../intake-damage-map.js'

const damages: IntakeDamage[] = [
  { id: 'd1', type: IntakeDamageType.Scratch, x: 100, y: 60, zone: 'zadnja vrata' },
]

describe('IntakeDamageMap', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('drops the orientation words on the detail, where 9px would be an illegible smudge', () => {
    const { queryByText, rerender } = render(
      <IntakeDamageMap vehicleType={IntakeVehicleType.Car} damages={[]} />,
    )
    expect(queryByText(m.intake_map_front())).not.toBeNull()

    rerender(<IntakeDamageMap vehicleType={IntakeVehicleType.Car} damages={[]} variant="detail" />)
    expect(queryByText(m.intake_map_front())).toBeNull()
  })

  it('draws the detail at the prototype 152×248 and the wizard at 236×386', () => {
    const { container, rerender } = render(
      <IntakeDamageMap vehicleType={IntakeVehicleType.Car} damages={[]} />,
    )
    const svg = (): SVGSVGElement => container.querySelector('svg') as SVGSVGElement
    expect(svg().getAttribute('width')).toBe('236')
    expect(svg().getAttribute('height')).toBe('386')

    rerender(<IntakeDamageMap vehicleType={IntakeVehicleType.Car} damages={[]} variant="detail" />)
    expect(svg().getAttribute('width')).toBe('152')
    expect(svg().getAttribute('height')).toBe('248')
  })

  /**
   * The prototype's detail map (`prijem-prototip-v2.dc.html:494-504`) keeps the number inside its
   * circle and grows it slightly — r 17 against the wizard's 16 — because the whole drawing is
   * rendered at 45 %. The list beside it does not carry the numbering on its own.
   */
  it('keeps the numbers in their circles on the detail, a size larger', () => {
    const { container, getByText, rerender } = render(
      <IntakeDamageMap vehicleType={IntakeVehicleType.Car} damages={damages} variant="detail" />,
    )

    expect(getByText('1')).toBeInTheDocument()
    expect(container.querySelector('circle')?.getAttribute('r')).toBe('17')

    rerender(<IntakeDamageMap vehicleType={IntakeVehicleType.Car} damages={damages} />)
    expect(container.querySelector('circle')?.getAttribute('r')).toBe('16')
  })
})
