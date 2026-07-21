import { describe, expect, it } from 'vitest'

import { deriveClaimStage } from '../emotive-claim-stage-badge'

describe('deriveClaimStage', () => {
  it('is received when neither timestamp is set', () => {
    expect(deriveClaimStage(null, null)).toBe('received')
  })

  it('is in_progress when client-visible but not yet published', () => {
    expect(deriveClaimStage('2026-07-21T00:00:00.000Z', null)).toBe('in_progress')
  })

  it('is published once publishedAt is set', () => {
    expect(deriveClaimStage('2026-07-21T00:00:00.000Z', '2026-07-21T01:00:00.000Z')).toBe(
      'published',
    )
  })
})
