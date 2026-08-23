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
  it('shows a serviser Servis and Razgovori, and nothing else', () => {
    // Razgovori joined on 2026-08-23. It is gated on INTERNAL_APP_PERMISSIONS on purpose — the
    // chat is the whole internal shop, the serviser included (chat spec §3.4, Nikola's N4).
    expect(keysFor([...SERVISER_PERMISSIONS])).toEqual(['razgovori', 'servis'])
  })

  it('names his entries exactly, so a stray ungated one cannot slip in beside them', () => {
    // This used to assert "fewer than two", because one entry means the shell draws no sidebar.
    // The chat legitimately gave him a second, so counting no longer says anything — but the
    // reason the guard exists does: an entry that forgot its `permissions` would appear HERE,
    // and an exact list still catches it. The serviser having a sidebar is now expected.
    expect(keysFor([...SERVISER_PERMISSIONS])).toEqual(['razgovori', 'servis'])
    expect(keysFor([])).toEqual([])
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
    // `statistics.view_*` is part of INTERNAL_APP_PERMISSIONS, so this account reaches the chat
    // too — that is the point of gating chat on "may enter the internal app" rather than on a
    // permission of its own (Nikola, 2026-08-23).
    expect(keysFor([...STATISTICS_VIEW_PERMISSIONS])).toEqual(['razgovori', 'statistika'])
  })
})
