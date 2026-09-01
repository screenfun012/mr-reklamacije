import { m } from '@mr/i18n'
import { ClaimKind } from '@mr/shared'

import { InternalPill } from '~/components/internal-pill'

/**
 * Claim-kind pill in the internal design language (blue INOSTRANA / purple
 * DOMAĆA). Internal-only — the shared ClaimKindBadge keeps serving admin.
 * Reads the same `claims_kind_*` labels as the shared badge, so a rename of
 * the kind happens in one place (the messages), never here.
 */
export function KindPill({ kind, className }: { kind: ClaimKind; className?: string }) {
  const emotive = kind === ClaimKind.Emotive
  return (
    <InternalPill tone={emotive ? 'info' : 'domace'} className={className}>
      {emotive ? m.claims_kind_emotive() : m.claims_kind_domace()}
    </InternalPill>
  )
}
