import { describe, expect, it } from 'vitest'

import { ClaimDetailSearchSchema, ClaimDetailTab } from '../claim-detail-search.js'

describe('ClaimDetailSearchSchema', () => {
  it('defaults tab to pregled when omitted', () => {
    expect(ClaimDetailSearchSchema.parse({})).toEqual({ tab: ClaimDetailTab.Pregled })
  })

  it('accepts all supported tab slugs', () => {
    expect(ClaimDetailSearchSchema.parse({ tab: 'kvarovi' }).tab).toBe(ClaimDetailTab.Kvarovi)
    expect(ClaimDetailSearchSchema.parse({ tab: 'prilozi' }).tab).toBe(ClaimDetailTab.Prilozi)
    expect(ClaimDetailSearchSchema.parse({ tab: 'izvestaj' }).tab).toBe(ClaimDetailTab.Izvestaj)
  })

  it('rejects unknown tab values', () => {
    expect(() => ClaimDetailSearchSchema.parse({ tab: 'unknown' })).toThrow()
  })
})
