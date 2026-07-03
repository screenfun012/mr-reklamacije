import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { Link, useNavigate } from '@tanstack/react-router'

import { authClient } from '~/lib/auth-client'
import { companyInitials } from '~/lib/portal-format'

import { LangThemeControls } from './lang-theme-controls'
import { PortalLogo } from './masked-icon'

/** Sticky blurred app header (dashboard + claim detail). */
export function PortalHeader({
  company,
  maxWidthClass = 'max-w-[1280px]',
}: {
  company: string
  maxWidthClass?: string
}) {
  const navigate = useNavigate()

  const handleSignOut = (): void => {
    void (async () => {
      await authClient.signOut()
      await navigate({ to: '/login' })
    })()
  }

  return (
    <div className="sticky top-0 z-20 border-b border-mrp-border bg-mrp-hdr backdrop-blur-[14px]">
      <div
        className={cn('mx-auto flex h-16 items-center justify-between px-5 sm:px-8', maxWidthClass)}
      >
        <Link to="/claims" aria-label="MR Engines">
          <PortalLogo className="h-[34px] w-[126px]" />
        </Link>
        <div className="flex items-center gap-3">
          <LangThemeControls compact />
          <span className="mx-1 hidden h-[26px] w-px bg-mrp-border sm:block" />
          <span className="grid size-9 flex-none place-items-center rounded-full bg-mrp-red text-[13px] font-bold text-white">
            {companyInitials(company)}
          </span>
          <div className="hidden leading-[1.15] sm:block">
            <div className="text-[13.5px] font-bold">{company}</div>
            <button
              type="button"
              onClick={handleSignOut}
              className="cursor-pointer text-[11.5px] text-mrp-text2 transition-colors hover:text-mrp-redh"
            >
              {m.portal_signout()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
