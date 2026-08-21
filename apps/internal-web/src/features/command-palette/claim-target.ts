import {
  CLAIM_DETAIL_DEFAULT_SEARCH,
  ClaimKind,
  type ClaimDetailSearch,
  type ClaimListItem,
} from '@mr/shared'

type ClaimDetailTarget =
  | { to: '/reklamacije/emotive/$id'; params: { id: string }; search: ClaimDetailSearch }
  | { to: '/reklamacije/domace/$id'; params: { id: string }; search: ClaimDetailSearch }

/**
 * Maps a claim list item to its internal detail route, keyed on `kind` (never inferred).
 * `categoryCode` travels along when the claim was opened from one category's list, so the
 * detail can point back at it and the sidebar can keep that entry lit.
 */
export function claimDetailTarget(
  claim: Pick<ClaimListItem, 'kind' | 'id'>,
  categoryCode?: string,
): ClaimDetailTarget {
  const search: ClaimDetailSearch =
    categoryCode === undefined
      ? CLAIM_DETAIL_DEFAULT_SEARCH
      : { ...CLAIM_DETAIL_DEFAULT_SEARCH, categoryCode }

  if (claim.kind === ClaimKind.Emotive) {
    return { to: '/reklamacije/emotive/$id', params: { id: claim.id }, search }
  }
  return { to: '/reklamacije/domace/$id', params: { id: claim.id }, search }
}
