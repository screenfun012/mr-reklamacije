import { m } from '@mr/i18n'
import { ClaimOutcome, ClientClaimPhase, type ClientClaimListItem } from '@mr/shared'

/**
 * Visual mapping of the server-derived three-phase status, straight from the
 * design prototype (`chipFor` + progress-segment logic). Status hues are theme
 * constants; brand red is deliberately NEVER used for the rejected state.
 */
export const PHASE_COLOR = {
  info: '#2e90fa',
  warn: '#f5a623',
  ok: '#1fa971',
  bad: '#e05c52',
} as const

export const PHASE_TINT = {
  info: 'rgba(46,144,250,.13)',
  warn: 'rgba(245,166,35,.13)',
  ok: 'rgba(31,169,113,.13)',
  bad: 'rgba(217,45,32,.13)',
} as const

export interface StatusChipConfig {
  label: string
  color: string
  tint: string
  icon: 'dot' | 'cog' | 'x'
}

type PhaseSource = Pick<ClientClaimListItem, 'clientPhase' | 'outcome'>

/**
 * Live claim status — READS the server-computed `clientPhase` field directly.
 * The server (`@mr/shared`'s client-claim phase derivation, which gates on
 * the client-visibility timestamps as well as `outcome`) is the single source
 * of truth; the portal never re-derives it locally. `Received` IS a live
 * status now: while the claim is not yet client-visible it reads Received
 * everywhere (chip, tri-bar, timeline) and its detail route 404s server-side.
 */
export function portalPhase(claim: PhaseSource): ClientClaimPhase {
  return claim.clientPhase
}

export function statusChipConfig(claim: PhaseSource): StatusChipConfig {
  const phase = portalPhase(claim)
  if (phase === ClientClaimPhase.Received) {
    return {
      label: m.portal_status_received(),
      color: PHASE_COLOR.info,
      tint: PHASE_TINT.info,
      icon: 'dot',
    }
  }
  if (phase === ClientClaimPhase.InProgress) {
    return {
      label: m.portal_status_in_progress(),
      color: PHASE_COLOR.warn,
      tint: PHASE_TINT.warn,
      icon: 'cog',
    }
  }
  if (claim.outcome === ClaimOutcome.Rejected) {
    return {
      label: m.portal_status_declined(),
      color: PHASE_COLOR.bad,
      tint: PHASE_TINT.bad,
      icon: 'x',
    }
  }
  return {
    label: m.portal_status_accepted(),
    color: PHASE_COLOR.ok,
    tint: PHASE_TINT.ok,
    icon: 'dot',
  }
}

export interface TriBarConfig {
  s1: string
  s2: string
  s3: string
  s2Pulsing: boolean
}

/** 3-segment card progress bar: received → bar 1 only, in progress → amber first two, outcome → all three. */
export function triBarConfig(claim: PhaseSource, trackColor: string): TriBarConfig {
  const phase = portalPhase(claim)
  if (phase === ClientClaimPhase.Received) {
    return { s1: PHASE_COLOR.info, s2: trackColor, s3: trackColor, s2Pulsing: false }
  }
  if (phase === ClientClaimPhase.InProgress) {
    return { s1: PHASE_COLOR.warn, s2: PHASE_COLOR.warn, s3: trackColor, s2Pulsing: true }
  }
  const color = claim.outcome === ClaimOutcome.Rejected ? PHASE_COLOR.bad : PHASE_COLOR.ok
  return { s1: color, s2: color, s3: color, s2Pulsing: false }
}

/**
 * Service type ('engine' | 'head' | 'block' | 'crank'). The claims system only
 * tracks whole-engine remanufacture today; machining claims arrive with a
 * future internal-app feature, at which point this gains a claim parameter and
 * reads the real field.
 */
export type PortalServiceType = 'engine' | 'head' | 'block' | 'crank'

export function claimServiceType(): PortalServiceType {
  return 'engine'
}

export function serviceTypeLabel(service: PortalServiceType): string {
  switch (service) {
    case 'engine':
      return m.portal_service_engine()
    case 'head':
      return m.portal_service_head()
    case 'block':
      return m.portal_service_block()
    case 'crank':
      return m.portal_service_crank()
  }
}
