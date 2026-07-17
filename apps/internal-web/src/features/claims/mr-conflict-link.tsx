import { Link } from '@tanstack/react-router'

import { CLAIM_DETAIL_DEFAULT_SEARCH, ClaimKind, type MrRegistryExistingClaim } from '@mr/shared'
import { m } from '@mr/i18n'

/** Link to the claim that already owns an MR number (pre-flight warning + 409 note). */
export function MrConflictLink({
  existing,
}: {
  existing: MrRegistryExistingClaim
}): React.ReactElement {
  return (
    <Link
      to={
        existing.kind === ClaimKind.Emotive ? '/reklamacije/emotive/$id' : '/reklamacije/domace/$id'
      }
      params={{ id: existing.claimId }}
      search={CLAIM_DETAIL_DEFAULT_SEARCH}
      className="underline underline-offset-2"
    >
      {m.claims_create_mr_conflict_link()}
    </Link>
  )
}
