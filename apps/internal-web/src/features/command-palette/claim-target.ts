import {
  CLAIM_DETAIL_DEFAULT_SEARCH,
  ClaimKind,
  type ClaimDetailSearch,
  type ClaimListItem,
} from '@mr/shared'

type ClaimDetailTarget =
  | { to: '/reklamacije/emotive/$id'; params: { id: string }; search: ClaimDetailSearch }
  | { to: '/reklamacije/domace/$id'; params: { id: string }; search: ClaimDetailSearch }

/** Maps a claim list item to its internal detail route, keyed on `kind` (never inferred). */
export function claimDetailTarget(claim: Pick<ClaimListItem, 'kind' | 'id'>): ClaimDetailTarget {
  if (claim.kind === ClaimKind.Emotive) {
    return {
      to: '/reklamacije/emotive/$id',
      params: { id: claim.id },
      search: CLAIM_DETAIL_DEFAULT_SEARCH,
    }
  }
  return {
    to: '/reklamacije/domace/$id',
    params: { id: claim.id },
    search: CLAIM_DETAIL_DEFAULT_SEARCH,
  }
}
