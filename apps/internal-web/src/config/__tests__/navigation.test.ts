import {
  CLAIMS_LIST_VIEW_PERMISSIONS,
  MACHINING_CLAIM_CATEGORY_CODE,
  OPERATOR_PERMISSIONS,
  SERVISER_PERMISSIONS,
  STATISTICS_VIEW_PERMISSIONS,
} from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { filterVisibleNavItems, internalNavItems } from '../navigation'

function keysFor(permissions: readonly string[]): string[] {
  return filterVisibleNavItems(internalNavItems, permissions).map((item) => item.key)
}

describe('the machining entry', () => {
  it('opens the claims list filtered by the machining category', () => {
    const machining = internalNavItems.find((item) => item.key === 'masinska-obrada')

    // It used to open a screen that said the work was coming. The claims exist now, so the
    // entry has to land on them — and it must carry the filter, or it opens the whole list
    // and quietly says the shop does no machining separately at all.
    expect(machining?.to).toBe('/reklamacije')
    expect(machining?.search).toEqual({ categoryCode: MACHINING_CLAIM_CATEGORY_CODE })
  })
})

describe('internal navigation gating', () => {
  it('shows a serviser nothing but Servis', () => {
    expect(keysFor([...SERVISER_PERMISSIONS])).toEqual(['servis'])
  })

  it('is what makes the sidebar disappear for him — a single entry has nothing to navigate between', () => {
    // The shell renders the sidebar only above one item; this pins the input to that rule
    // so a stray ungated nav entry cannot silently give a serviser a sidebar back.
    expect(keysFor([...SERVISER_PERMISSIONS]).length).toBeLessThan(2)
  })

  it('gives the office the whole menu, Servis included', () => {
    const keys = keysFor([...OPERATOR_PERMISSIONS])
    expect(keys).toEqual(expect.arrayContaining(['pocetna', 'reklamacije', 'servis', 'statistika']))
  })

  it('keeps Servis away from someone with only claims access', () => {
    expect(keysFor([...CLAIMS_LIST_VIEW_PERMISSIONS])).not.toContain('servis')
  })

  it('gates Početna and Statistika, which used to be visible to everyone', () => {
    // Regression: both were ungated, so a serviser would have seen a claim-shaped dashboard
    // and a statistics screen he holds no permission to read (docs/25 §3.1).
    expect(keysFor([])).toEqual([])
    expect(keysFor([...STATISTICS_VIEW_PERMISSIONS])).toEqual(['statistika'])
  })
})
