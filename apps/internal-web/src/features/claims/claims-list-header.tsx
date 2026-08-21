import { m } from '@mr/i18n'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { internalButtonClasses } from '~/components/internal-button'

import type { ClaimsListMode } from './claims-list-mode'

export interface ClaimsListHeaderProps {
  mode: ClaimsListMode
  /** Open claims across everything the reader may see — the "all" subtitle's number. */
  pendingTotal: number
  canCreateEmotive: boolean
  canCreateDomace: boolean
}

/**
 * Eyebrow, title, subtitle and the create buttons — measured off the prototype
 * (`kategorije-prototip.dc.html`, the list header block).
 *
 * The container query is deliberate: what fits here depends on the width the sidebar leaves,
 * not on the viewport, and a `sm:` breakpoint does not know the sidebar exists.
 *
 * ONE "+ Nova reklamacija" button, as the prototype draws it: the wizard asks which kind the
 * claim is, so the header no longer has to. Inside a category the button carries it along, so
 * the wizard opens on the kind of work you were already looking at.
 */
export function ClaimsListHeader({
  mode,
  pendingTotal,
  canCreateEmotive,
  canCreateDomace,
}: ClaimsListHeaderProps): React.ReactElement {
  const isCategory = mode.kind === 'category'
  const title = isCategory ? (mode.category?.name ?? mode.code) : m.claims_list_all_title()
  const subtitle = isCategory
    ? m.claims_list_category_subtitle({
        pending: String(mode.category?.pending ?? 0),
        total: String(mode.category?.total ?? 0),
      })
    : m.claims_list_all_subtitle({ pending: String(pendingTotal) })

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @min-[640px]:flex-row @min-[640px]:items-start">
        <div className="flex flex-col gap-[5px]">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-mri-red">
            {isCategory ? m.claims_list_eyebrow_category() : m.claims_list_eyebrow_all()}
          </p>
          <h1 className="text-[26px] font-black tracking-[-0.02em] text-mri-text">{title}</h1>
          <p className="text-[13px] text-mri-text2">{subtitle}</p>
        </div>

        {canCreateEmotive || canCreateDomace ? (
          <div className="flex flex-wrap gap-2.5 self-start @min-[640px]:ml-auto">
            <Link
              to="/reklamacije/nova"
              search={mode.kind === 'category' ? { categoryCode: mode.code } : {}}
              className={internalButtonClasses('primary', 'h-10 w-auto px-[18px] text-xs')}
            >
              <Plus className="size-4" aria-hidden="true" />
              {m.crumb_new_claim()}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
