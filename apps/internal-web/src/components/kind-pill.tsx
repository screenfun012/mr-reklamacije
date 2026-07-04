import { m } from '@mr/i18n'
import { ClaimKind } from '@mr/shared'

import { InternalPill } from '~/components/internal-pill'

/**
 * Claim-kind pill in the internal design language (blue EMOTIVE / purple
 * DOMAĆA). Internal-only — the shared ClaimKindBadge keeps serving admin.
 * "EMOTIVE" is a protected domain term and is never translated.
 */
export function KindPill({ kind, className }: { kind: ClaimKind; className?: string }) {
  const emotive = kind === ClaimKind.Emotive
  return (
    <InternalPill tone={emotive ? 'info' : 'domace'} className={className}>
      {emotive ? 'EMOTIVE' : m.internal_kind_domace()}
    </InternalPill>
  )
}
