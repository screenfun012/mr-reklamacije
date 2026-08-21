import { describe, expect, it } from 'vitest'

import { ClaimDetailSearchSchema, ClaimDetailTab } from '../claim-detail-search.js'

describe('ClaimDetailSearchSchema', () => {
  it('defaults tab to pregled when omitted', () => {
    expect(ClaimDetailSearchSchema.parse({})).toEqual({ tab: ClaimDetailTab.Pregled })
  })

  it('accepts all supported tab slugs', () => {
    expect(ClaimDetailSearchSchema.parse({ tab: 'nalazi' }).tab).toBe(ClaimDetailTab.Nalazi)
    expect(ClaimDetailSearchSchema.parse({ tab: 'prilozi' }).tab).toBe(ClaimDetailTab.Prilozi)
    expect(ClaimDetailSearchSchema.parse({ tab: 'izvestaj' }).tab).toBe(ClaimDetailTab.Izvestaj)
  })

  it('falls back to pregled for a tab slug this build does not have', () => {
    // `kvarovi` was a tab until the faults moved into the claim's own edit — a link that
    // still carries it must open the claim, not the route's error component.
    expect(ClaimDetailSearchSchema.parse({ tab: 'kvarovi' }).tab).toBe(ClaimDetailTab.Pregled)
    expect(ClaimDetailSearchSchema.parse({ tab: 'unknown' }).tab).toBe(ClaimDetailTab.Pregled)
  })
})
