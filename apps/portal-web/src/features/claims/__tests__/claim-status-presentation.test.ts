import { setLocale } from '@mr/i18n'
import { ClaimOutcome, ClientClaimPhase, type ClientClaimListItem } from '@mr/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { portalPhase, statusChipConfig, triBarConfig } from '../claim-status-presentation'

type PhaseSource = Pick<ClientClaimListItem, 'clientPhase' | 'outcome'>

function claim(overrides: Partial<PhaseSource> = {}): PhaseSource {
  return {
    clientPhase: ClientClaimPhase.InProgress,
    outcome: ClaimOutcome.Pending,
    ...overrides,
  }
}

describe('portalPhase', () => {
  beforeEach(() => setLocale('sr'))

  it('reads claim.clientPhase directly, not a local re-derivation from outcome', () => {
    // Contrived pairing that could never come from toClientClaimListItem (a
    // published claim always carries a resolved real outcome) — proves the
    // function returns the server field verbatim instead of recomputing a
    // phase from `outcome` alone the way the old 1-arg signature did.
    expect(
      portalPhase(claim({ clientPhase: ClientClaimPhase.Outcome, outcome: ClaimOutcome.Pending })),
    ).toBe(ClientClaimPhase.Outcome)
    expect(
      portalPhase(claim({ clientPhase: ClientClaimPhase.Received, outcome: ClaimOutcome.Pending })),
    ).toBe(ClientClaimPhase.Received)
  })

  it('renders InProgress when clientPhase says so, even with a masked pending outcome', () => {
    expect(
      portalPhase(
        claim({ clientPhase: ClientClaimPhase.InProgress, outcome: ClaimOutcome.Pending }),
      ),
    ).toBe(ClientClaimPhase.InProgress)
  })
})

describe('statusChipConfig', () => {
  beforeEach(() => setLocale('sr'))

  it('returns the Received chip (bar 1, dot icon) for clientPhase received', () => {
    const chip = statusChipConfig(claim({ clientPhase: ClientClaimPhase.Received }))
    expect(chip.label).toBe('Primljena')
    expect(chip.icon).toBe('dot')
  })

  it('returns the in-progress chip for clientPhase in_progress', () => {
    const chip = statusChipConfig(claim({ clientPhase: ClientClaimPhase.InProgress }))
    expect(chip.label).toBe('U obradi')
    expect(chip.icon).toBe('cog')
  })

  it('returns the accepted chip for an outcome-phase claim with outcome accepted', () => {
    const chip = statusChipConfig(
      claim({ clientPhase: ClientClaimPhase.Outcome, outcome: ClaimOutcome.Accepted }),
    )
    expect(chip.label).toBe('Prihvaćena')
  })

  it('returns the declined chip for an outcome-phase claim with outcome rejected', () => {
    const chip = statusChipConfig(
      claim({ clientPhase: ClientClaimPhase.Outcome, outcome: ClaimOutcome.Rejected }),
    )
    expect(chip.label).toBe('Odbijena')
  })
})

describe('triBarConfig', () => {
  it('lights only bar 1 for Received', () => {
    const bar = triBarConfig(claim({ clientPhase: ClientClaimPhase.Received }), 'track')
    expect(bar.s1).not.toBe('track')
    expect(bar.s2).toBe('track')
    expect(bar.s3).toBe('track')
  })
})
