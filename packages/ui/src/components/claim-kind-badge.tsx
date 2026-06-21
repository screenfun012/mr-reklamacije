import { m } from '@mr/i18n'
import { CLAIM_KIND_BY_KEY, type ClaimKind, type ClaimKindLabelKey } from '@mr/shared'

import { KIND_ICONS } from '../lib/badge-icons.js'
import { BADGE_ICON_CLASSES, BADGE_SHELL_CLASSES } from '../lib/badge-styles.js'
import { cn } from '../lib/cn.js'

const KIND_LABELS: Record<ClaimKindLabelKey, () => string> = {
  claims_kind_domace: () => m.claims_kind_domace(),
  claims_kind_emotive: () => m.claims_kind_emotive(),
}

export interface ClaimKindBadgeProps {
  kind: ClaimKind
  className?: string
}

export function ClaimKindBadge({ kind, className }: ClaimKindBadgeProps): React.ReactElement {
  const definition = CLAIM_KIND_BY_KEY[kind]
  const Icon = KIND_ICONS[kind]

  return (
    <span className={cn(BADGE_SHELL_CLASSES, definition.badgeClass, className)}>
      <Icon className={BADGE_ICON_CLASSES} aria-hidden />
      {KIND_LABELS[definition.labelKey]()}
    </span>
  )
}
