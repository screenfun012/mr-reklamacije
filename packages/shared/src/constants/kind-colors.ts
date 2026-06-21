import { ClaimKind, type ClaimKind as ClaimKindType } from '../enums.js'

/** Tailwind classes for unified claim kind badges (docs/09-ui-ux.md). */
export const KIND_BADGE_CLASSES: Record<ClaimKindType, string> = {
  [ClaimKind.Domace]:
    'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100',
  [ClaimKind.Emotive]:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
}

export const KIND_DOT_CLASSES: Record<ClaimKindType, string> = {
  [ClaimKind.Domace]: 'bg-sky-500',
  [ClaimKind.Emotive]: 'bg-emerald-500',
}
