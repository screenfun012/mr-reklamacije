/** Radix Select rejects empty string values; map filter "all" to this sentinel. */
export const FILTER_ALL_SENTINEL = '__all__' as const

export type FilterAllSentinel = typeof FILTER_ALL_SENTINEL
