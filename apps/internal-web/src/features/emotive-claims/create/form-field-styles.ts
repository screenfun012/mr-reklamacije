/** Radix Select rejects empty string values in controlled mode. */
export const SELECT_EMPTY_SENTINEL = '__empty__' as const

export const TEXTAREA_FIELD_CLASS =
  'flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
