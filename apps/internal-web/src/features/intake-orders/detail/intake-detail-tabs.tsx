import { m } from '@mr/i18n'
import { IntakeDetailTab, type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

/**
 * The tab is a URL param, and the param is not gated by what the screen draws — a pasted or
 * bookmarked `/prijem/<draft>?tab=istorija` reaches a draft, which offers neither Specifikacija
 * nor Istorija (§4.8). Left alone that leaves the reader on a strip with no active tab and a
 * body that is not there. Same hole `visibleIntakeSearch` closes for `?view=deleted`.
 */
export function visibleIntakeDetailTab(
  tab: IntakeDetailTab | undefined,
  signedAt: string | null,
): IntakeDetailTab {
  const active = tab ?? IntakeDetailTab.Pregled
  if (signedAt !== null || active === IntakeDetailTab.Fotografije) {
    return active
  }
  return IntakeDetailTab.Pregled
}

const DRAFT_TABS: readonly IntakeDetailTab[] = [
  IntakeDetailTab.Pregled,
  IntakeDetailTab.Fotografije,
]

const SIGNED_TABS: readonly IntakeDetailTab[] = [
  IntakeDetailTab.Pregled,
  IntakeDetailTab.Fotografije,
  IntakeDetailTab.Spec,
  IntakeDetailTab.Istorija,
]

function tabLabel(tab: IntakeDetailTab, photoCount: number): string {
  const labels: Record<IntakeDetailTab, string> = {
    [IntakeDetailTab.Pregled]: m.intake_tab_pregled(),
    [IntakeDetailTab.Fotografije]: m.intake_tab_fotografije({ count: photoCount }),
    [IntakeDetailTab.Spec]: m.intake_tab_spec(),
    [IntakeDetailTab.Istorija]: m.intake_tab_istorija(),
  }
  return labels[tab]
}

/**
 * Links rather than buttons: the tab lives in the URL, so a middle click and a shared link both
 * behave the way the address bar promises, and keyboard handling comes for free instead of being
 * re-implemented on a `role="tab"` strip. NOT the back button, deliberately — `replace` keeps tab
 * taps out of history, so Back leaves the order rather than walking four tabs backwards.
 */
export function IntakeDetailTabs({
  order,
  activeTab,
}: {
  order: IntakeOrderDetail
  activeTab: IntakeDetailTab
}): ReactElement {
  const tabs = order.signedAt === null ? DRAFT_TABS : SIGNED_TABS

  const classesFor = (tab: IntakeDetailTab): string =>
    cn(
      '-mb-px border-b-2 py-[13px] text-sm transition-colors',
      tab === activeTab
        ? 'border-mri-red font-bold text-mri-text'
        : 'border-transparent font-semibold text-mri-text2',
      tab !== activeTab && 'hover:text-mri-text',
    )

  return (
    <nav className="flex gap-6 border-b border-mri-border" aria-label={m.intake_detail_title()}>
      {tabs.map((tab) => (
        <Link
          key={tab}
          to="/prijem/$id"
          params={{ id: order.id }}
          search={{ tab }}
          replace
          aria-current={tab === activeTab ? 'page' : undefined}
          className={classesFor(tab)}
        >
          {tabLabel(tab, order.photos.length)}
        </Link>
      ))}
    </nav>
  )
}
