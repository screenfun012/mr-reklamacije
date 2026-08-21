import { m } from '@mr/i18n'
import { claimCategoryCountsOptions, type ClaimCategoryCountsResponse } from '@mr/shared'
import { cn, Popover, PopoverContent, PopoverTrigger } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { useState } from 'react'

import type { NavItem } from '~/config/navigation'
import { useStoredFlag } from '~/lib/use-stored-flag'

import { activeClaimsEntry, CLAIMS_ALL_ENTRY } from './active-claims-entry'

const OPEN_STORAGE_KEY = 'mrr:internal:nav:reklamacije-open'

export interface ClaimsNavChild {
  key: string
  label: string
  to: '/reklamacije' | '/reklamacije/kategorija/$categoryCode'
  params?: { categoryCode: string }
  count: number | null
}

/**
 * "Sve reklamacije" first, then every ACTIVE category in catalogue order. A retired category is
 * not a place anyone should be sent to — the claims that carry it still show it, in the list and
 * on their own detail. Counts appear only once loaded; `null` draws no badge at all.
 */
export function buildClaimsNavChildren(
  counts: ClaimCategoryCountsResponse | undefined,
): ClaimsNavChild[] {
  const all: ClaimsNavChild = {
    key: CLAIMS_ALL_ENTRY,
    label: m.nav_claims_all(),
    to: '/reklamacije',
    count: counts?.totals.pending ?? null,
  }

  const categories = (counts?.items ?? [])
    .filter((item) => item.isActive)
    .map<ClaimsNavChild>((item) => ({
      key: item.code,
      label: item.name,
      to: '/reklamacije/kategorija/$categoryCode',
      params: { categoryCode: item.code },
      count: item.pending,
    }))

  return [all, ...categories]
}

function CountBadge({
  count,
  active,
}: {
  count: number | null
  active: boolean
}): React.ReactElement | null {
  if (count === null) {
    return null
  }

  return (
    <span
      className={cn(
        'ml-auto font-mono text-[10.5px] tabular-nums',
        active ? 'font-semibold' : 'font-medium',
        count > 0 ? 'text-mri-amb' : 'text-mri-text2 opacity-45',
      )}
    >
      {count}
    </span>
  )
}

function ChildLink({
  child,
  active,
  flyout,
  onNavigate,
}: {
  child: ClaimsNavChild
  active: boolean
  flyout: boolean
  onNavigate: () => void
}): React.ReactElement {
  return (
    <Link
      to={child.to}
      {...(child.params === undefined ? {} : { params: child.params })}
      title={child.label}
      onClick={onNavigate}
      // `activeClaimsEntry` is the ONE rule for which child is the current place. The router's
      // own matching is prefix-based, so it called "Sve reklamacije" active on a category's route
      // and lit two entries at once; `exact` narrows its opinion to a subset of this rule's,
      // where the two can no longer disagree.
      activeOptions={{ exact: true }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center text-[12.5px] transition-colors hover:bg-mri-rowhv',
        flyout ? 'h-[31px] rounded-lg px-[9px]' : 'h-8 rounded-r-lg pl-3 pr-[10px]',
        active
          ? 'bg-[rgba(237,28,36,.11)] font-bold text-mri-text shadow-[inset_2px_0_0_var(--mri-red)]'
          : 'font-semibold text-mri-text2',
      )}
    >
      <span className="truncate">{child.label}</span>
      <CountBadge count={child.count} active={active} />
    </Link>
  )
}

export interface ClaimsNavGroupProps {
  item: NavItem
  collapsed: boolean
  onNavigate: () => void
}

export function ClaimsNavGroup({
  item,
  collapsed,
  onNavigate,
}: ClaimsNavGroupProps): React.ReactElement {
  const location = useLocation({
    select: (loc) => ({ pathname: loc.pathname, search: loc.search as Record<string, unknown> }),
  })
  // Deliberately not suspense: a slow or failed count must never take the menu down with it.
  // The group then simply renders "Sve reklamacije" with no badge (V2 spec §5).
  const { data: counts } = useQuery(claimCategoryCountsOptions())
  const [open, setOpen] = useStoredFlag(OPEN_STORAGE_KEY, true)
  const [flyoutOpen, setFlyoutOpen] = useState(false)

  const children = buildClaimsNavChildren(counts)
  const active = activeClaimsEntry(location)
  const groupActive = active !== null
  const pendingTotal = counts?.totals.pending ?? 0

  if (collapsed) {
    return (
      <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={item.label()}
            aria-label={item.label()}
            className={cn(
              'relative mx-auto grid size-[38px] cursor-pointer place-items-center rounded-[9px] transition-colors',
              groupActive
                ? 'bg-[rgba(237,28,36,.11)] text-mri-text'
                : 'text-mri-text2 hover:bg-mri-rowhv',
            )}
          >
            <item.icon className={cn('size-[18px]', groupActive && 'text-mri-redh')} />
            {pendingTotal > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-[3px] top-[3px] size-[7px] rounded-full bg-mri-amb"
              />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-[200px] rounded-xl border-mri-border2 bg-mri-raised p-[7px] shadow-[0_18px_44px_rgba(0,0,0,.55)]"
        >
          <p className="px-[9px] pb-[5px] pt-[6px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.18em] text-mri-text2">
            {item.label()}
          </p>
          {children.map((child) => (
            <ChildLink
              key={child.key}
              child={child}
              active={active === child.key}
              flyout
              onNavigate={() => {
                setFlyoutOpen(false)
                onNavigate()
              }}
            />
          ))}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          'flex h-[38px] cursor-pointer items-center gap-[10px] rounded-[9px] px-[11px] text-[13.5px] transition-colors hover:bg-mri-rowhv',
          groupActive ? 'font-bold text-mri-text' : 'font-semibold text-mri-text2',
        )}
      >
        <item.icon
          className={cn('size-[18px] flex-none', groupActive ? 'text-mri-redh' : 'text-mri-text2')}
        />
        <span className="truncate">{item.label()}</span>
        <span className="ml-auto flex items-center gap-2">
          {pendingTotal > 0 ? (
            <span className="rounded-full bg-[rgba(234,179,8,.13)] px-[7px] py-[2px] font-mono text-[10px] font-semibold text-mri-amb">
              {pendingTotal}
            </span>
          ) : null}
          <span aria-hidden="true" className="text-[9px] text-mri-text2">
            {open ? '▾' : '▸'}
          </span>
        </span>
      </button>
      {open ? (
        <div className="mb-1 ml-[21px] flex flex-col border-l border-mri-border">
          {children.map((child) => (
            <ChildLink
              key={child.key}
              child={child}
              active={active === child.key}
              flyout={false}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
