import { m } from '@mr/i18n'
import { useRouterState } from '@tanstack/react-router'

import { LocaleThemeControls } from './locale-theme-controls'

function sectionLabel(pathname: string): string {
  if (pathname.startsWith('/reklamacije')) {
    return m.nav_reklamacije()
  }
  if (pathname.startsWith('/statistika')) {
    return m.nav_statistika()
  }
  if (pathname.startsWith('/pristiglo')) {
    return m.nav_pristiglo()
  }
  if (pathname.startsWith('/settings')) {
    return m.nav_security()
  }
  return m.nav_pocetna()
}

/** Sticky blurred topbar: mono breadcrumb `INTERNO / {SECTION}` + EN/SR + theme. */
export function InternalTopbar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <div className="sticky top-0 z-20 border-b border-mri-border bg-mri-hdr backdrop-blur-[14px]">
      <div className="flex h-[58px] items-center justify-between gap-4 px-8">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mri-text2">
          {m.internal_breadcrumb_prefix()} <span className="text-mri-redh">/</span>{' '}
          {sectionLabel(pathname)}
        </span>
        <LocaleThemeControls />
      </div>
    </div>
  )
}
