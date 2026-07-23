import type { ClaimKind } from '@mr/shared'
import { m } from '@mr/i18n'
import { Eye } from 'lucide-react'

import { useClaimPresence } from './use-claim-presence'

/**
 * "Someone else is here" strip on a claim detail. The claim already has hard
 * concurrency protection (a save by the loser 409s and does not overwrite), so
 * this is the soft heads-up that stops two people wasting effort on the same edit.
 */
export function ClaimPresenceBar({
  kind,
  id,
}: {
  kind: ClaimKind
  id: string
}): React.ReactElement | null {
  const others = useClaimPresence(kind, id)

  if (others.length === 0) {
    return null
  }

  const message =
    others.length === 1
      ? m.claim_presence_one({ name: others[0]?.name ?? '' })
      : m.claim_presence_many({ count: others.length })

  return (
    <div
      role="status"
      aria-label={m.claim_presence_aria()}
      className="flex items-center gap-2.5 rounded-[11px] border border-mri-warn/40 bg-mri-warn-bg px-3.5 py-2.5 text-[13px] text-mri-text"
    >
      <Eye className="size-4 flex-none text-mri-warn" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
