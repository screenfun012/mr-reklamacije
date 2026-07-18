import { m } from '@mr/i18n'
import { ClaimOutcome, ClientClaimPhase, type ClientClaimDetail } from '@mr/shared'

import { MaskedIcon } from '~/components/masked-icon'
import { SectionNewBadge } from '~/components/section-new-badge'
import { formatPortalDate } from '~/lib/portal-format'

import { PHASE_COLOR, portalPhase } from './claim-status-presentation'

const NODE_BASE =
  'absolute top-1/2 box-content size-[15px] rounded-full border-[3px] border-mrp-surface'

interface TimelineState {
  fillWidth: string
  fillColor: string
  node1: string
  node2: string
  node3: string
  label2Color: string
  label3Color: string
  sub2: string
  sub3: string
}

function timelineState(claim: ClientClaimDetail): TimelineState {
  const phase = portalPhase(claim)
  const outcomeColor = claim.outcome === ClaimOutcome.Rejected ? PHASE_COLOR.bad : PHASE_COLOR.ok
  const track = 'var(--mrp-border2)'

  // The first node ("Received") is now the LIVE current stage while the server
  // has not yet made the claim client-visible; it advances to In progress once
  // visible, then to Outcome once published.
  if (phase === ClientClaimPhase.Received) {
    return {
      fillWidth: '0%',
      fillColor: PHASE_COLOR.info,
      node1: PHASE_COLOR.info,
      node2: track,
      node3: track,
      label2Color: 'var(--mrp-text2)',
      label3Color: 'var(--mrp-text2)',
      sub2: '—',
      sub3: '—',
    }
  }
  if (phase === ClientClaimPhase.InProgress) {
    return {
      fillWidth: '50%',
      fillColor: PHASE_COLOR.warn,
      node1: PHASE_COLOR.warn,
      node2: PHASE_COLOR.warn,
      node3: track,
      label2Color: PHASE_COLOR.warn,
      label3Color: 'var(--mrp-text2)',
      sub2: m.portal_timeline_in_workshop(),
      sub3: '—',
    }
  }
  return {
    fillWidth: '100%',
    fillColor: outcomeColor,
    node1: outcomeColor,
    node2: outcomeColor,
    node3: outcomeColor,
    label2Color: 'var(--mrp-text)',
    label3Color: outcomeColor,
    sub2: m.portal_timeline_done(),
    sub3:
      claim.outcome === ClaimOutcome.Rejected
        ? m.portal_status_declined()
        : m.portal_status_accepted(),
  }
}

/** Horizontal 3-node claim timeline (Received → In progress → Outcome). */
export function TimelineCard({ claim }: { claim: ClientClaimDetail }) {
  const tl = timelineState(claim)
  const phase = portalPhase(claim)
  const inProgress = phase === ClientClaimPhase.InProgress
  const rejected = phase === ClientClaimPhase.Outcome && claim.outcome === ClaimOutcome.Rejected

  return (
    <div
      className="mrp-fade-up mb-[26px] rounded-[15px] border border-mrp-border bg-mrp-surface px-6 pb-[26px] pt-[30px] sm:px-[34px]"
      style={{ animationDelay: '0.12s' }}
    >
      {claim.sectionFreshness.outcome && (
        <div className="mb-3 flex justify-end">
          <SectionNewBadge />
        </div>
      )}
      <div className="relative mx-2.5 mb-5 mt-2 h-[5px] rounded-[3px] bg-mrp-border">
        <div
          className="mrp-grow-w absolute inset-y-0 left-0 max-w-full rounded-[3px]"
          style={{ width: tl.fillWidth, background: tl.fillColor }}
        />
        <span
          className={NODE_BASE}
          style={{ left: 0, transform: 'translate(-50%,-50%)', background: tl.node1 }}
        />
        {inProgress ? (
          <span className="mrp-spin-cog absolute left-1/2 top-1/2 -ml-3.5 -mt-3.5 grid size-7 place-items-center rounded-full bg-mrp-surface text-mrp-warn">
            <MaskedIcon name="cog" className="size-6" />
          </span>
        ) : (
          <span
            className={NODE_BASE}
            style={{ left: '50%', transform: 'translate(-50%,-50%)', background: tl.node2 }}
          />
        )}
        {rejected ? (
          <span className="absolute left-full top-1/2 -ml-3 -mt-3 grid size-6 place-items-center rounded-full bg-mrp-surface">
            <MaskedIcon name="x" className="size-[17px] text-mrp-bad" />
          </span>
        ) : (
          <span
            className={NODE_BASE}
            style={{ left: '100%', transform: 'translate(-50%,-50%)', background: tl.node3 }}
          />
        )}
      </div>

      <div className="flex justify-between">
        <div className="text-left">
          <div className="text-[13px] font-bold">{m.portal_status_received()}</div>
          <div className="mt-[3px] font-mono text-[11px] text-mrp-text2">
            {formatPortalDate(claim.dateOfClaim)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[13px] font-bold" style={{ color: tl.label2Color }}>
            {m.portal_status_in_progress()}
          </div>
          <div className="mt-[3px] font-mono text-[11px] text-mrp-text2">{tl.sub2}</div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-bold" style={{ color: tl.label3Color }}>
            {m.portal_status_outcome()}
          </div>
          <div className="mt-[3px] font-mono text-[11px] text-mrp-text2">{tl.sub3}</div>
          {!inProgress && claim.dateOfFinish ? (
            <div className="mt-[2px] font-mono text-[11px] text-mrp-text2">
              {formatPortalDate(claim.dateOfFinish)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
