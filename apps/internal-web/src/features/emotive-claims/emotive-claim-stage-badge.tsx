import { m } from '@mr/i18n'

import { InternalPill, type InternalPillTone } from '~/components/internal-pill'

/**
 * Operator-facing client-visibility stage, derived from the two lifecycle
 * timestamps. Distinct from the portal's `clientPhase` (which mirrors the
 * outcome once published) — this always reflects internal progress.
 */
export type ClaimStage = 'received' | 'in_progress' | 'published'

export function deriveClaimStage(
  clientVisibleAt: string | null,
  publishedAt: string | null,
): ClaimStage {
  if (publishedAt !== null) {
    return 'published'
  }
  if (clientVisibleAt !== null) {
    return 'in_progress'
  }
  return 'received'
}

const STAGE_TONE: Record<ClaimStage, InternalPillTone> = {
  received: 'neutral',
  in_progress: 'info',
  published: 'ok',
}

const STAGE_LABEL: Record<ClaimStage, () => string> = {
  received: () => m.emotive_claims_stage_received(),
  in_progress: () => m.emotive_claims_stage_in_progress(),
  published: () => m.emotive_claims_stage_published(),
}

export interface EmotiveClaimStageBadgeProps {
  clientVisibleAt: string | null
  publishedAt: string | null
}

/** Read-only EMOTIVE client-visibility stage pill (Primljeno / U obradi / Objavljeno). */
export function EmotiveClaimStageBadge({
  clientVisibleAt,
  publishedAt,
}: EmotiveClaimStageBadgeProps): React.ReactElement {
  const stage = deriveClaimStage(clientVisibleAt, publishedAt)
  return <InternalPill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]()}</InternalPill>
}
