import { m } from '@mr/i18n'
import { IntakeOrderHistoryEntrySchema, type IntakeOrderHistoryEntry } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { historyLabel } from '../history-labels.js'

/**
 * Parsed through the wire schema for the same reason `render-detail.tsx` parses the order fixture:
 * `tsconfig.json` excludes `__tests__` from typecheck, so a bare literal typed as the wire shape
 * rots silently the day the projection changes.
 *
 * `fromStatus`/`toStatus` default to the signed order's own status rather than to null, because
 * that is what the server actually sends for every transition — the audit `changes` carry whole
 * before/after objects, so `status` is present on a signature exactly as it is on a status move.
 */
function entry(overrides: Partial<IntakeOrderHistoryEntry>): IntakeOrderHistoryEntry {
  return IntakeOrderHistoryEntrySchema.parse({
    id: '33333333-3333-4333-8333-333333333333',
    at: '2026-07-27T18:42:00.000Z',
    action: 'update',
    transition: null,
    actorName: 'Miloš Jovanović',
    fromStatus: 'primljeno',
    toStatus: 'primljeno',
    ...overrides,
  })
}

/**
 * Every row the server can write, so deleting any single entry from the lookup map fails here.
 * A table is the only shape that keeps the map honest as more transitions land.
 */
const EVERY_TRANSITION: readonly [string, () => string][] = [
  ['sign', m.intake_history_signed],
  ['spec_updated', m.intake_history_spec_updated],
  ['contact_added', m.intake_history_contact_added],
  ['handover', m.intake_history_handover],
  // The row that says a vehicle went back with nothing signed. It arrives as a STATUS move
  // (gotovo → preuzeto) and must still read as the release it is, not as "Status: …" — the missing
  // signatures are the only record of it, and this line is where anyone looks for them.
  ['handover_skipped', m.intake_history_handover_skipped],
]

describe('historyLabel', () => {
  it.each(EVERY_TRANSITION)('names the %s row', (transition, expected) => {
    expect(historyLabel(entry({ transition }))).toBe(expected())
  })

  it('names the creation from the action, which carries no transition', () => {
    expect(historyLabel(entry({ action: 'create', transition: null }))).toBe(
      m.intake_history_created(),
    )
  })

  it('names a status move with both ends', () => {
    expect(
      historyLabel(entry({ transition: 'advance', fromStatus: 'primljeno', toStatus: 'u_radu' })),
    ).toBe(
      m.intake_history_status({ from: m.intake_status_primljeno(), to: m.intake_status_u_radu() }),
    )
  })

  it('names an office status correction the same way', () => {
    expect(
      historyLabel(
        entry({ transition: 'change_status', fromStatus: 'gotovo', toStatus: 'u_radu' }),
      ),
    ).toBe(
      m.intake_history_status({ from: m.intake_status_gotovo(), to: m.intake_status_u_radu() }),
    )
  })

  /*
   * `sign` and `spec_updated` both carry non-null from/toStatus, because their audit `changes` hold
   * whole before/after objects. A label that branched on `fromStatus !== null` before the
   * transition check would call both a status move.
   */
  it('does not read a signature as a status move', () => {
    expect(historyLabel(entry({ transition: 'sign' }))).toBe(m.intake_history_signed())
  })

  it('falls back to a neutral clause rather than leaking an English key', () => {
    expect(historyLabel(entry({ transition: 'something_new' }))).toBe(m.intake_history_generic())
  })

  /*
   * The wire types both statuses as plain strings, so a status the frontend does not know is
   * reachable — a fifth status shipped by the API before this screen learns it. Half a status
   * line ("Status: U radu → ") is worse than none.
   */
  it('says nothing specific rather than half a status line when a status is unknown', () => {
    expect(historyLabel(entry({ transition: 'advance', toStatus: 'na_cekanju' }))).toBe(
      m.intake_history_generic(),
    )
    expect(historyLabel(entry({ transition: 'advance', fromStatus: null }))).toBe(
      m.intake_history_generic(),
    )
  })
})
