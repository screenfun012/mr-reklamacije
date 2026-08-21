import { m } from '@mr/i18n'

import { InternalPill } from '~/components/internal-pill'

export interface EmotiveClaimPublishedBadgeProps {
  publishedAt: string | null
}

/**
 * OBJAVLJENO / NIJE OBJAVLJENO — the two-state badge the handoff puts in the "Klijent vidi"
 * card and in the report tab's header (§1, §5). It REPORTS; it is never a button.
 *
 * Deliberately not {@link EmotiveClaimStageBadge}: that one has three states and repeats the
 * words already written in the timeline beneath it. Here the only question is whether the
 * client can see an outcome yet.
 */
export function EmotiveClaimPublishedBadge({
  publishedAt,
}: EmotiveClaimPublishedBadgeProps): React.ReactElement {
  return publishedAt === null ? (
    <InternalPill tone="neutral">{m.emotive_claims_stage_not_published()}</InternalPill>
  ) : (
    <InternalPill tone="ok">{m.emotive_claims_stage_published()}</InternalPill>
  )
}
