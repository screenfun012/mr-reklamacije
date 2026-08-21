import { m } from '@mr/i18n'
import { Link } from '@tanstack/react-router'

export interface ClaimDetailBackLinkProps {
  /** The category list this claim was opened from, when it was one. */
  categoryCode?: string | undefined
}

const LINK_CLASS =
  'self-start font-sans text-[11.5px] font-bold uppercase tracking-[0.06em] text-mri-text2 transition-colors hover:text-mri-text'

/**
 * "← Nazad na listu" — back to where the reader actually came from: the category's own list
 * when the claim was opened from one, the whole list otherwise. Two separate `<Link>`s rather
 * than one with a computed `to`: the router types each route's params and search on its own,
 * and a union of the two is not something a single link can express.
 */
export function ClaimDetailBackLink({
  categoryCode,
}: ClaimDetailBackLinkProps): React.ReactElement {
  if (categoryCode !== undefined) {
    return (
      <Link
        to="/reklamacije/kategorija/$categoryCode"
        params={{ categoryCode }}
        search={{ page: 1, pageSize: 10 }}
        className={LINK_CLASS}
      >
        {m.emotive_claims_create_back_to_list()}
      </Link>
    )
  }

  return (
    <Link to="/reklamacije" search={{ page: 1, pageSize: 10 }} className={LINK_CLASS}>
      {m.emotive_claims_create_back_to_list()}
    </Link>
  )
}
