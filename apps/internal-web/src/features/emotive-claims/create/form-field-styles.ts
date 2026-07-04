import { INTERNAL_CONTROL_CLASSES } from '~/components/internal-field'

/** Radix Select rejects empty string values in controlled mode. */
export const SELECT_EMPTY_SENTINEL = '__empty__' as const

/** 44px form control in the design language (README wizard inputs). */
export const FORM_CONTROL_CLASS = `${INTERNAL_CONTROL_CLASSES} h-11 w-full text-sm`

export const TEXTAREA_FIELD_CLASS = `${INTERNAL_CONTROL_CLASSES} min-h-[96px] w-full px-3 py-2 text-sm`
