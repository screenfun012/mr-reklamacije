import { m } from '@mr/i18n'
import { AuditAction, type IntakeOrderHistoryEntry } from '@mr/shared'

import { INTAKE_STATUS_LABELS, INTAKE_STATUS_ORDER } from '../intake-status'

/**
 * Complete against the server: `IntakeOrdersService` writes exactly these plus `advance`,
 * `change_status` and `action = 'create'`, while `photo_uploaded`, `photo_removed` and
 * transition-less updates are filtered out in SQL (`intake-orders.repository.ts:677-680`) and
 * `discard_draft` belongs to a row that no longer exists.
 */
const TRANSITION_LABELS: Record<string, () => string> = {
  sign: m.intake_history_signed,
  spec_updated: m.intake_history_spec_updated,
  soft_delete: m.intake_history_removed,
  restore: m.intake_history_restored,
}

/**
 * The wire types both statuses as plain strings — a status this screen has not learned yet is
 * reachable — so the union is recovered by looking the value up in the order the app already
 * knows, rather than by indexing the label map and asserting the key exists.
 */
function statusLabel(value: string | null): string | null {
  const known = INTAKE_STATUS_ORDER.find((status) => status === value)
  return known === undefined ? null : INTAKE_STATUS_LABELS[known]()
}

export function historyLabel(entry: IntakeOrderHistoryEntry): string {
  if (entry.action === AuditAction.Create) {
    return m.intake_history_created()
  }

  if (entry.transition === 'advance' || entry.transition === 'change_status') {
    const from = statusLabel(entry.fromStatus)
    const to = statusLabel(entry.toStatus)
    // Half a status line ("Status: U radu → ") is worse than no status line at all.
    return from === null || to === null
      ? m.intake_history_generic()
      : m.intake_history_status({ from, to })
  }

  // Every other transition carries a before/after object, so both statuses are non-null here too —
  // which is why the transition, never the presence of a status, decides what this row says.
  const known = entry.transition === null ? undefined : TRANSITION_LABELS[entry.transition]
  return known === undefined ? m.intake_history_generic() : known()
}
