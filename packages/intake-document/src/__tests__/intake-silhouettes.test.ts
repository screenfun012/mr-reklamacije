import { IntakeVehicleType } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { INTAKE_SILHOUETTES, INTAKE_SILHOUETTE_VIEWBOX } from '../intake-silhouettes'

/**
 * These guard a transfer, not a design. The paths came out of `prijem-prototip-v2` verbatim and
 * every damage marker is positioned in their coordinate space, so a "tidied" path silently moves
 * every recorded damage on the screen and on the printed work order.
 */
describe('INTAKE_SILHOUETTES', () => {
  it('keeps the prototype path count per vehicle', () => {
    expect(INTAKE_SILHOUETTES[IntakeVehicleType.Car]).toHaveLength(11)
    expect(INTAKE_SILHOUETTES[IntakeVehicleType.Van]).toHaveLength(12)
    expect(INTAKE_SILHOUETTES[IntakeVehicleType.Pickup]).toHaveLength(14)
    expect(INTAKE_SILHOUETTES[IntakeVehicleType.Suv]).toHaveLength(13)
  })

  it('starts each vehicle with its body outline, unchanged', () => {
    expect(INTAKE_SILHOUETTES[IntakeVehicleType.Car][0]?.d).toBe(
      'M170 34 c-31 0 -53 4 -59 12 -6 8 -10 27 -12 45 -14 4 -21 15 -21 31 v296 c0 16 7 27 21 31 2 18 6 37 12 45 6 8 28 12 59 12 s53 -4 59 -12 c6 -8 10 -27 12 -45 14 -4 21 -15 21 -31 v-296 c0 -16 -7 -27 -21 -31 -2 -18 -6 -37 -12 -45 -6 -8 -28 -12 -59 -12 z',
    )
    expect(INTAKE_SILHOUETTES[IntakeVehicleType.Van][0]?.d).toBe(
      'M104 30 h132 q14 0 18 12 l8 32 q8 4 8 18 v340 q0 14 -8 18 l-8 32 q-4 12 -18 12 h-132 q-14 0 -18 -12 l-8 -32 q-8 -4 -8 -18 v-340 q0 -14 8 -18 l8 -32 q4 -12 18 -12 z',
    )
  })

  it('draws every vehicle in one shared space, or markers would land differently per type', () => {
    expect(INTAKE_SILHOUETTE_VIEWBOX).toBe('0 0 340 556')
  })

  it('holds only path data — no stray markup or transforms crept in', () => {
    for (const paths of Object.values(INTAKE_SILHOUETTES)) {
      for (const path of paths) {
        expect(path.d.startsWith('M')).toBe(true)
        expect(path.d).toMatch(/^[MmLlHhVvCcSsQqZz0-9.\s-]+$/)
        expect(path.op).toMatch(/^(0|\.\d+)$/)
      }
    }
  })
})
