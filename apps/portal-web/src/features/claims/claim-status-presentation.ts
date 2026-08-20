import { m } from '@mr/i18n'
import {
  ClaimOutcome,
  ClientClaimPhase,
  ENGINE_OVERHAUL_CLAIM_CATEGORY_CODE,
  MACHINING_CLAIM_CATEGORY_CODE,
  type ClientClaimListItem,
} from '@mr/shared'

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
 * Service type. A claim now carries a category, so the coarse split — whole-engine overhaul
 * vs machining — is read from it rather than assumed.
 *
 * The finer types ('head' | 'block' | 'crank') are the PART being machined, which is a Faza 2
 * field and must NOT be guessed from the category: every machining claim would come out as the
 * same part. They stay in the union unused until that field exists.
 *
 * `null` for a category the portal has no tab for. The catalogue is Nikola's to extend, and an
 * unknown category must not be labelled as one of these two — no label is honest, a wrong one
 * is a claim about someone's engine.
 */
export type PortalServiceType = 'engine' | 'head' | 'block' | 'crank' | 'machining'

const SERVICE_TYPE_BY_CATEGORY_CODE: Record<string, PortalServiceType> = {
  [ENGINE_OVERHAUL_CLAIM_CATEGORY_CODE]: 'engine',
  [MACHINING_CLAIM_CATEGORY_CODE]: 'machining',
}

export function claimServiceType(
  claim: Pick<ClientClaimListItem, 'categoryCode'>,
): PortalServiceType | null {
  if (claim.categoryCode === null) {
    return null
  }
  return SERVICE_TYPE_BY_CATEGORY_CODE[claim.categoryCode] ?? null
}

/** The dashboard's service tabs, and the category each one asks the server for. */
export type PortalServiceFilter = 'all' | 'engine' | 'machining'

export function categoryCodeForServiceFilter(filter: PortalServiceFilter): string | undefined {
  if (filter === 'engine') {
    return ENGINE_OVERHAUL_CLAIM_CATEGORY_CODE
  }
  if (filter === 'machining') {
    return MACHINING_CLAIM_CATEGORY_CODE
  }
  return undefined
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
    case 'machining':
      return m.portal_service_machining()
  }
}
