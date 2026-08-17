import { m } from '@mr/i18n'
import { IntakeOrderStatus } from '@mr/shared'

import type { InternalPillTone } from '~/components/internal-pill'

/**
 * Status → pill tone. Verified against the handoff's palette: Primljeno blue, U radu amber,
 * Gotovo green, Preuzeto the muted archived tone. No new tokens (docs/25 §3.1).
 */
export const INTAKE_STATUS_TONES: Record<IntakeOrderStatus, InternalPillTone> = {
  [IntakeOrderStatus.Received]: 'info',
  [IntakeOrderStatus.InProgress]: 'warn',
  [IntakeOrderStatus.Done]: 'ok',
  [IntakeOrderStatus.PickedUp]: 'archived',
}

export const INTAKE_STATUS_LABELS: Record<IntakeOrderStatus, () => string> = {
  [IntakeOrderStatus.Received]: m.intake_status_primljeno,
  [IntakeOrderStatus.InProgress]: m.intake_status_u_radu,
  [IntakeOrderStatus.Done]: m.intake_status_gotovo,
  [IntakeOrderStatus.PickedUp]: m.intake_status_preuzeto,
}

export const INTAKE_STATUS_ORDER = [
  IntakeOrderStatus.Received,
  IntakeOrderStatus.InProgress,
  IntakeOrderStatus.Done,
  IntakeOrderStatus.PickedUp,
] as const

/**
 * The status the advance button moves to, or `null` at the end of the line. `preuzeto` is
 * terminal and the server answers a further advance with a 409, so hiding the button and
 * refusing the call agree instead of contradicting each other.
 */
export function nextIntakeStatus(current: IntakeOrderStatus): IntakeOrderStatus | null {
  return INTAKE_STATUS_ORDER[INTAKE_STATUS_ORDER.indexOf(current) + 1] ?? null
}

/**
 * All three date formats live with the document that prints them.
 *
 * They used to be defined here, over private copies of the same two `Intl` helpers the package had
 * — and that duplication is exactly how the time zone came to be fixed in one half while the other
 * kept printing the server's clock (2026-08-17). Re-exported so every caller here is untouched and
 * there is one definition.
 */
export {
  formatIntakeHistoryAt,
  formatIntakeReceivedAt,
  formatIntakeReceivedAtLong,
} from '@mr/intake-document'
