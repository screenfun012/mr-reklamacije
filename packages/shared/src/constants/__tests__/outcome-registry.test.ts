import { describe, expect, it } from 'vitest'

import { ClaimOutcome } from '../../enums.js'
import { OUTCOME_BY_KEY, OUTCOME_REGISTRY } from '../outcome-registry.js'

describe('OUTCOME_REGISTRY', () => {
  it('covers every ClaimOutcome value', () => {
    const keys = OUTCOME_REGISTRY.map((definition) => definition.key)
    expect(keys).toEqual(Object.values(ClaimOutcome))
  })

  it('exposes stable lookup by key', () => {
    expect(OUTCOME_BY_KEY[ClaimOutcome.Pending].labelKey).toBe('outcome_pending')
    expect(OUTCOME_BY_KEY[ClaimOutcome.Archived].color).toBe('slate')
  })
})
