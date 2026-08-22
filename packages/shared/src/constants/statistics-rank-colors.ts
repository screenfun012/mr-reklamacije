export const STATISTICS_UNKNOWN_CODE = 'UNKNOWN'

/** UI roll-up bucket — not a catalog code like `OSTALO`. */
export const STATISTICS_OTHERS_CODE = 'OTHERS'

/**
 * The two honest buckets of the category-field section, and the reason they are two and not one:
 * "nobody wrote the answer down" is a statement about the shop, while "the question did not exist
 * yet when the claim was opened" is a statement about the catalogue and falls on its own. Neither
 * is a catalogue code, so neither carries a name from the server — the client labels them.
 */
export const STATISTICS_FIELD_UNFILLED_CODE = '__UNFILLED__'
export const STATISTICS_FIELD_PREDATES_CODE = '__PREDATES__'

/** How many bars a rank chart draws before the rest roll up into `OTHERS`. */
export const STATISTICS_RANK_TOP_N = 10
