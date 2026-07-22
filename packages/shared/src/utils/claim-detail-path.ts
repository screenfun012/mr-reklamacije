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

/**
 * Keyed by kind rather than `if domace else emotive`: a third family would have
 * silently inherited the EMOTIVE route and 404'd. Adding a kind now fails to compile
 * until its route is declared here.
 */
const DETAIL_ROUTE_BY_KIND: Record<ClaimKindType, ClaimDetailLink['to']> = {
  [ClaimKind.Domace]: '/reklamacije/domace/$id',
  [ClaimKind.Emotive]: '/reklamacije/emotive/$id',
}

export function claimDetailPath(kind: ClaimKindType, id: string): ClaimDetailLink {
  return {
    to: DETAIL_ROUTE_BY_KIND[kind],
    params: { id },
    search: CLAIM_DETAIL_DEFAULT_SEARCH,
  }
}
