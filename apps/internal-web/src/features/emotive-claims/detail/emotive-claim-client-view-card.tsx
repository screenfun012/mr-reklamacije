import { m } from '@mr/i18n'
import {
  ClientClaimPhase,
  deriveClientClaimPhase,
  formatListDate,
  type EmotiveClaimDetail,
} from '@mr/shared'
import { cn } from '@mr/ui'

import { usePublishEmotiveClaim } from './use-publish-emotive-claim'

export interface EmotiveClaimClientViewCardProps {
  claim: EmotiveClaimDetail
  /** Holder of `emotive_claims.publish` (operator + admin). */
  canPublish: boolean
}

interface Stage {
  label: string
  /** `null` while the stage has not been reached — or when no date came with it. */
  at: string | null
  dot: 'done' | 'current' | 'todo'
}

/** A stage without a usable timestamp shows no date rather than taking the card down. */
function stageDate(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * What the client is looking at right now, as three stages with the dates behind them
 * (prototype §6, right column). EMOTIVE only — DOMAĆA has no portal.
 *
 * The stages are not a design flourish: they are the two timestamps the server actually keeps.
 * `client_visible_at` is stamped by the first client-visible inspection report (Gate A) and
 * `published_at` by the deliberate publish (Gate B), so the card can only ever say what is true.
 */
function stagesOf(claim: EmotiveClaimDetail): Stage[] {
  const received: Stage = {
    label: m.emotive_claims_client_stage_received(),
    at: stageDate(claim.createdAt),
    dot: 'done',
  }

  // The stage the client is actually on comes from the SHARED rule, not from a second reading
  // of the same two timestamps here — a claim that is published but still undecided reads
  // "U obradi" on the portal, and this card has to say the same thing.
  const phase = deriveClientClaimPhase(claim.outcome, {
    clientVisibleAt: claim.clientVisibleAt,
    publishedAt: claim.publishedAt,
  })

  const reachedInProgress = phase !== ClientClaimPhase.Received
  const inProgress: Stage = {
    label: m.emotive_claims_client_stage_in_progress(),
    at: stageDate(claim.clientVisibleAt ?? claim.publishedAt),
    dot: reachedInProgress ? 'done' : 'todo',
  }

  const decided = phase === ClientClaimPhase.Outcome
  const outcome: Stage = {
    label: decided
      ? m.emotive_claims_client_stage_outcome()
      : m.emotive_claims_client_stage_outcome_unpublished(),
    // A date only once the client can actually see an outcome — otherwise the row would carry
    // the publish date beside the words "not published".
    at: decided ? stageDate(claim.publishedAt) : null,
    dot: decided ? 'done' : 'todo',
  }

  return [received, inProgress, outcome]
}

const DOT_CLASSES: Record<Stage['dot'], string> = {
  done: 'bg-mri-ok',
  current: 'bg-mri-info',
  todo: 'border border-mri-text2',
}

export function EmotiveClaimClientViewCard({
  claim,
  canPublish,
}: EmotiveClaimClientViewCardProps): React.ReactElement {
  const publish = usePublishEmotiveClaim(claim.id)
  const stages = stagesOf(claim)
  const showPublish = canPublish && claim.publishedAt === null

  return (
    <section className="overflow-hidden rounded-[14px] border border-mri-border bg-mri-surface">
      <h2 className="border-b border-mri-border px-[18px] py-[13px] text-[14.5px] font-extrabold text-mri-text">
        {m.emotive_claims_client_view_title()}
      </h2>

      <div className="flex flex-col gap-2.5 px-[18px] py-[15px]">
        {stages.map((stage) => (
          <div
            key={stage.label}
            className={cn('flex items-center gap-[9px]', stage.dot === 'todo' && 'opacity-50')}
          >
            <span
              aria-hidden="true"
              className={cn('size-2 flex-none rounded-full', DOT_CLASSES[stage.dot])}
            />
            <span className="text-[12.5px] font-semibold text-mri-text">{stage.label}</span>
            {stage.at === null ? null : (
              <span className="ml-auto font-mono text-[10px] font-medium text-mri-text2">
                {formatListDate(stage.at)}
              </span>
            )}
          </div>
        ))}

        {showPublish ? (
          <button
            type="button"
            onClick={() => publish.mutate()}
            disabled={publish.isPending}
            className="mt-1 inline-flex h-[34px] cursor-pointer items-center self-start rounded-[9px] border border-mri-border2 bg-mri-raised px-[13px] text-[11px] font-bold uppercase tracking-[0.06em] text-mri-text transition-colors hover:border-mri-text2 disabled:opacity-60"
          >
            {m.emotive_claims_publish_action()}
          </button>
        ) : null}
      </div>
    </section>
  )
}
