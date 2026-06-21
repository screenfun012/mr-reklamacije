import { ClaimKind, type ClaimKind as ClaimKindType } from '../enums.js'
import { KIND_BADGE_CLASSES } from './kind-colors.js'

export type ClaimKindLabelKey = 'claims_kind_domace' | 'claims_kind_emotive'

export interface ClaimKindDefinition {
  key: ClaimKindType
  labelKey: ClaimKindLabelKey
  badgeClass: string
}

export const CLAIM_KIND_REGISTRY: readonly ClaimKindDefinition[] = [
  {
    key: ClaimKind.Domace,
    labelKey: 'claims_kind_domace',
    badgeClass: KIND_BADGE_CLASSES[ClaimKind.Domace],
  },
  {
    key: ClaimKind.Emotive,
    labelKey: 'claims_kind_emotive',
    badgeClass: KIND_BADGE_CLASSES[ClaimKind.Emotive],
  },
] as const

export const CLAIM_KIND_BY_KEY: Record<ClaimKindType, ClaimKindDefinition> = Object.fromEntries(
  CLAIM_KIND_REGISTRY.map((definition) => [definition.key, definition]),
) as Record<ClaimKindType, ClaimKindDefinition>
