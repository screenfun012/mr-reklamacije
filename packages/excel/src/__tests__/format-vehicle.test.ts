import { describe, expect, it } from 'vitest'

import { formatVehicle } from '../format-vehicle.js'

describe('formatVehicle', () => {
  it('joins manufacturer, engine type and engine code', () => {
    expect(formatVehicle('Mercedes-Benz', 'OM651', 'ENG-1')).toBe('Mercedes-Benz OM651 ENG-1')
  })

  it('skips the empty parts', () => {
    expect(formatVehicle('Renault', 'M9T', null)).toBe('Renault M9T')
    expect(formatVehicle('Fiat', null, null)).toBe('Fiat')
  })

  it('returns null when nothing is set', () => {
    expect(formatVehicle(null, null, null)).toBeNull()
    expect(formatVehicle('', '  ', null)).toBeNull()
  })
})
