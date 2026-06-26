import type { EngineTypeListItem } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import {
  buildEngineTypeSearchableOptions,
  engineTypeToSearchableOption,
  isOrphanOnlyEngineTypeSelection,
} from '../engine-type-options.js'

const BMW_TYPE: EngineTypeListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'N47D20D',
  manufacturerId: '22222222-2222-4222-8222-222222222222',
  manufacturerName: 'BMW',
  displacementCc: 1995,
  notes: null,
  isActive: true,
  usageCount: 0,
}

const MERCEDES_TYPE: EngineTypeListItem = {
  id: '33333333-3333-4333-8333-333333333333',
  code: 'OM651',
  manufacturerId: '44444444-4444-4444-8444-444444444444',
  manufacturerName: 'Mercedes-Benz',
  displacementCc: 2143,
  notes: null,
  isActive: true,
  usageCount: 0,
}

describe('engineTypeToSearchableOption', () => {
  it('maps code to label and keywords', () => {
    expect(engineTypeToSearchableOption(BMW_TYPE)).toEqual({
      value: BMW_TYPE.id,
      label: 'N47D20D',
      keywords: 'N47D20D',
    })
  })
})

describe('buildEngineTypeSearchableOptions', () => {
  it('returns catalog options when nothing is selected', () => {
    expect(buildEngineTypeSearchableOptions([BMW_TYPE, MERCEDES_TYPE], '')).toEqual([
      engineTypeToSearchableOption(BMW_TYPE),
      engineTypeToSearchableOption(MERCEDES_TYPE),
    ])
  })

  it('prepends orphan option when selected id is missing from filtered list', () => {
    expect(
      buildEngineTypeSearchableOptions([BMW_TYPE], MERCEDES_TYPE.id, {
        id: MERCEDES_TYPE.id,
        code: MERCEDES_TYPE.code,
      }),
    ).toEqual([
      { value: MERCEDES_TYPE.id, label: 'OM651', keywords: 'OM651' },
      engineTypeToSearchableOption(BMW_TYPE),
    ])
  })

  it('does not duplicate selected option when it is already in the list', () => {
    expect(buildEngineTypeSearchableOptions([BMW_TYPE], BMW_TYPE.id)).toEqual([
      engineTypeToSearchableOption(BMW_TYPE),
    ])
  })
})

describe('isOrphanOnlyEngineTypeSelection', () => {
  it('is true when manufacturer is empty but legacy engine type is selected', () => {
    expect(
      isOrphanOnlyEngineTypeSelection('', MERCEDES_TYPE.id, {
        id: MERCEDES_TYPE.id,
        code: MERCEDES_TYPE.code,
      }),
    ).toBe(true)
  })

  it('is false when manufacturer is selected', () => {
    expect(
      isOrphanOnlyEngineTypeSelection(BMW_TYPE.manufacturerId ?? '', BMW_TYPE.id, {
        id: BMW_TYPE.id,
        code: BMW_TYPE.code,
      }),
    ).toBe(false)
  })
})
