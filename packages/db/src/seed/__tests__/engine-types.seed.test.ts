import { describe, expect, it } from 'vitest'

import { CANONICAL_ENGINE_TYPE_SEEDS } from '../engine-types.js'

describe('CANONICAL_ENGINE_TYPE_SEEDS', () => {
  it('links each canonical engine type to a manufacturer code', () => {
    expect(CANONICAL_ENGINE_TYPE_SEEDS).toEqual([
      { code: 'BMW N47D20D', manufacturerCode: 'BMW' },
      { code: 'Mercedes OM651', manufacturerCode: 'MERCEDES_BENZ' },
      { code: 'Range rover 448DT', manufacturerCode: 'LAND_ROVER' },
      { code: 'Ford YMF', manufacturerCode: 'FORD' },
      { code: 'Opel A20DTH', manufacturerCode: 'OPEL' },
    ])
  })
})
