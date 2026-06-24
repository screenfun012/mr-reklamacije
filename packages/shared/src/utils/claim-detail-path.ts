import { ClaimKind, type ClaimKind as ClaimKindType } from '../enums.js'
import {
  CLAIM_DETAIL_DEFAULT_SEARCH,
  type ClaimDetailSearch,
} from '../queries/claim-detail-search.js'

export interface ClaimDetailLink {
  to: '/reklamacije/emotive/$id' | '/reklamacije/domace/$id'
  params: { id: string }
  search: ClaimDetailSearch
}

export function claimDetailPath(kind: ClaimKindType, id: string): ClaimDetailLink {
  if (kind === ClaimKind.Domace) {
    return {
      to: '/reklamacije/domace/$id',
      params: { id },
      search: CLAIM_DETAIL_DEFAULT_SEARCH,
    }
  }

  return {
    to: '/reklamacije/emotive/$id',
    params: { id },
    search: CLAIM_DETAIL_DEFAULT_SEARCH,
  }
}
