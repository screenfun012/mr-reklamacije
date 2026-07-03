import { ClaimKind, type ClaimKind as ClaimKindType } from '../enums.js'

/** Tailwind classes for unified claim kind badges (MR brandbook colors). */
export const KIND_BADGE_CLASSES: Record<ClaimKindType, string> = {
  [ClaimKind.Domace]:
    'border-mr-brand/40 bg-mr-brand-subtle text-mr-brand-strong shadow-sm shadow-mr-brand/15 dark:border-mr-brand/55 dark:bg-mr-brand/20 dark:text-mr-brand-400 dark:shadow-mr-brand/10',
  [ClaimKind.Emotive]:
    'border-mr-info/45 bg-mr-info-subtle text-mr-info-strong shadow-sm shadow-mr-info/15 dark:border-mr-info/55 dark:bg-mr-info/20 dark:text-mr-info dark:shadow-mr-info/10',
}

/** Saturated icon tint per claim kind. */
export const KIND_ICON_CLASSES: Record<ClaimKindType, string> = {
  [ClaimKind.Domace]: 'text-mr-brand',
  [ClaimKind.Emotive]: 'text-mr-info',
}
