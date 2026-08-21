import type { ClaimKind } from '@mr/shared'
import { m } from '@mr/i18n'
import { Eye } from 'lucide-react'

import { useClaimPresence } from './use-claim-presence'

/**
 * "Someone else is here" strip on a claim detail. The claim already has hard
 * concurrency protection (a save by the loser 409s and does not overwrite), so
 * this is the soft heads-up that stops two people wasting effort on the same edit.
 *
 * A chip, not a band: the claim screen opens with its title row, and a full-width coloured
 * strip across the top of it is what the 21.08. handoff sent back (§1.4).
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
      className="flex w-fit items-center gap-2 self-start rounded-[9px] border border-mri-warn/40 bg-mri-warn-bg px-3 py-1.5 text-[12px] text-mri-text"
    >
      <Eye className="size-3.5 flex-none text-mri-warn" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
