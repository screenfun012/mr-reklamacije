import {
  CLAIMS_LIST_VIEW_PERMISSIONS,
  OPERATOR_PERMISSIONS,
  SERVISER_PERMISSIONS,
  STATISTICS_VIEW_PERMISSIONS,
} from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { filterVisibleNavItems, internalNavItems } from '../navigation'

function keysFor(permissions: readonly string[]): string[] {
  return filterVisibleNavItems(internalNavItems, permissions).map((item) => item.key)
}

describe('the claims entry', () => {
  it('is a group whose children come from the catalogue, and no category has an entry of its own', () => {
    const claims = internalNavItems.find((item) => item.key === 'reklamacije')

    // A category is not a screen someone maintains here. It used to be: machining had its own
    // hardcoded entry, which is why adding a second kind of work meant editing this file.
    expect(claims?.children).toBe('claim-categories')
    expect(internalNavItems.some((item) => item.key === 'masinska-obrada')).toBe(false)
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
