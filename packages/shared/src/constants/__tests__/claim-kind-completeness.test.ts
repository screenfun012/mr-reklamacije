import { describe, expect, it } from 'vitest'

import { CLAIM_KIND_BY_KEY, CLAIM_KIND_REGISTRY } from '../kind-registry.js'
import { ClaimKind } from '../../enums.js'
import { claimDetailPath } from '../../utils/claim-detail-path.js'

const ALL_KINDS = Object.values(ClaimKind)

/**
 * These guard the moment a third claim family (machining) is added. The compiler
 * is the primary guard — every map here is a `Record<ClaimKind, …>` literal, so a
 * missing kind fails the build — and these tests are the backstop for anyone who
 * reaches for a cast to make the build pass.
 */
describe('claim-kind completeness', () => {
  it('has a registry entry for every kind', () => {
    for (const kind of ALL_KINDS) {
      expect(CLAIM_KIND_BY_KEY[kind]?.key).toBe(kind)
    }
    expect(CLAIM_KIND_REGISTRY).toHaveLength(ALL_KINDS.length)
  })

  it('routes every kind to its OWN detail screen', () => {
    const routes = ALL_KINDS.map(
      (kind) => claimDetailPath(kind, 'a4c0f0c2-0000-4000-8000-000000000001').to,
    )

    // A new kind silently inheriting another one's route is exactly the failure
    // the old `if domace … else emotive` would have produced.
    expect(new Set(routes).size).toBe(ALL_KINDS.length)
    expect(routes.every((route) => route !== undefined)).toBe(true)
  })

  it('keeps the display list and the keyed source of truth in agreement', () => {
    expect([...CLAIM_KIND_REGISTRY].map((definition) => definition.key).sort()).toEqual(
      [...ALL_KINDS].sort(),
    )
  })
})
