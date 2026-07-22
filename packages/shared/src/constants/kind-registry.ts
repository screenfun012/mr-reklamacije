import { ClaimKind, type ClaimKind as ClaimKindType } from '../enums.js'
import { KIND_BADGE_CLASSES } from './kind-colors.js'

export type ClaimKindLabelKey = 'claims_kind_domace' | 'claims_kind_emotive'

export interface ClaimKindDefinition {
  key: ClaimKindType
  labelKey: ClaimKindLabelKey
  badgeClass: string
}

/**
 * Keyed by kind, NOT built from a list with a cast. A `Record<ClaimKindType, …>`
 * literal is what makes the compiler refuse a new kind that nobody finished
 * wiring up — the previous `Object.fromEntries(...) as Record<…>` compiled
 * happily with a kind missing, which is exactly how a third family would have
 * slipped through half-wired. (`KIND_BADGE_CLASSES` already had it right.)
 */
export const CLAIM_KIND_BY_KEY: Record<ClaimKindType, ClaimKindDefinition> = {
  [ClaimKind.Domace]: {
    key: ClaimKind.Domace,
    labelKey: 'claims_kind_domace',
    badgeClass: KIND_BADGE_CLASSES[ClaimKind.Domace],
  },
  [ClaimKind.Emotive]: {
    key: ClaimKind.Emotive,
    labelKey: 'claims_kind_emotive',
    badgeClass: KIND_BADGE_CLASSES[ClaimKind.Emotive],
  },
}

/** Display order for pickers and legends; the record above is the source of truth. */
export const CLAIM_KIND_REGISTRY: readonly ClaimKindDefinition[] = [
  CLAIM_KIND_BY_KEY[ClaimKind.Domace],
  CLAIM_KIND_BY_KEY[ClaimKind.Emotive],
] as const
