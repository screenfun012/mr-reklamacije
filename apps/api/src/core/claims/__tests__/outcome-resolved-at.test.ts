import { ClaimOutcome } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { initialOutcomeResolvedAt, outcomeResolvedAtForTransition } from '../outcome-resolved-at.js'

const fixedDate = new Date('2026-04-17T10:00:00Z')

describe('outcomeResolvedAtForTransition', () => {
  it('sets resolved timestamp when resolving from pending', () => {
    expect(
      outcomeResolvedAtForTransition(ClaimOutcome.Pending, ClaimOutcome.Accepted, fixedDate),
    ).toEqual(fixedDate)
    expect(
      outcomeResolvedAtForTransition(ClaimOutcome.Pending, ClaimOutcome.Rejected, fixedDate),
    ).toEqual(fixedDate)
  })

  it('clears resolved timestamp when reopening to pending', () => {
    expect(
      outcomeResolvedAtForTransition(ClaimOutcome.Accepted, ClaimOutcome.Pending, fixedDate),
    ).toBeNull()
  })

  it('leaves resolved timestamp unchanged for pending to archived', () => {
    expect(
      outcomeResolvedAtForTransition(ClaimOutcome.Pending, ClaimOutcome.Archived, fixedDate),
    ).toBeUndefined()
  })
})

describe('initialOutcomeResolvedAt', () => {
  it('sets resolved timestamp for claims created as accepted or rejected', () => {
    expect(initialOutcomeResolvedAt(ClaimOutcome.Accepted, fixedDate)).toEqual(fixedDate)
    expect(initialOutcomeResolvedAt(ClaimOutcome.Rejected, fixedDate)).toEqual(fixedDate)
  })

  it('returns null for pending or archived create outcomes', () => {
    expect(initialOutcomeResolvedAt(ClaimOutcome.Pending, fixedDate)).toBeNull()
    expect(initialOutcomeResolvedAt(ClaimOutcome.Archived, fixedDate)).toBeNull()
  })
})
