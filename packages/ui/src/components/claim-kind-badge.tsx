import { m } from '@mr/i18n'
import {
  CLAIM_KIND_BY_KEY,
  KIND_DOT_CLASSES,
  type ClaimKind,
  type ClaimKindLabelKey,
} from '@mr/shared'
import { cn } from '../lib/cn.js'

const KIND_LABELS: Record<ClaimKindLabelKey, () => string> = {
  claims_kind_domace: () => m.claims_kind_domace(),
  claims_kind_emotive: () => m.claims_kind_emotive(),
}

export interface ClaimKindBadgeProps {
  kind: ClaimKind
  className?: string
}

export function ClaimKindBadge({ kind, className }: ClaimKindBadgeProps) {
  const definition = CLAIM_KIND_BY_KEY[kind]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        definition.badgeClass,
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', KIND_DOT_CLASSES[kind])} aria-hidden />
      {KIND_LABELS[definition.labelKey]()}
    </span>
  )
}
