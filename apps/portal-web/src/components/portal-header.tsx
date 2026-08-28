import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, MessageSquarePlus } from 'lucide-react'

import { authClient } from '~/lib/auth-client'
import { companyInitials } from '~/lib/portal-format'
import { usePortalCompany } from '~/lib/use-portal-company'

import { LangThemeControls } from './lang-theme-controls'
import { PortalLogo } from './masked-icon'

/**
 * Sticky blurred app header (dashboard + claim detail). Reads the company itself
 * so every screen shows the same, correct firm — callers used to pass it in, and
 * each derived it differently.
 */
export function PortalHeader({ maxWidthClass = 'max-w-[1280px]' }: { maxWidthClass?: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { primary, label } = usePortalCompany()

  const handleSignOut = (): void => {
    void (async () => {
      await authClient.signOut()
      // Signing out is a client-side navigation, so the cache would otherwise
      // outlive the session: on a shared computer the next person to sign in
      // sees the previous one's firm and claims until every query refetches.
      queryClient.clear()
      await navigate({ to: '/login' })
    })()
  }

  return (
    <div className="sticky top-0 z-20 border-b border-mrp-border bg-mrp-hdr backdrop-blur-[14px]">
      <div
        className={cn('mx-auto flex h-16 items-center justify-between px-4 sm:px-8', maxWidthClass)}
      >
        <Link to="/claims" aria-label="MR Engines">
          {/* The prototype's 126px wordmark from sm up; below it the header has to seat the
              firm, the sign-out and the language too, and 350px does not hold all of it. */}
          <PortalLogo className="h-[28px] w-[104px] sm:h-[34px] sm:w-[126px]" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/report"
            aria-label={m.portal_submit_nav()}
            className="flex items-center gap-2 rounded-[9px] border border-mrp-border2 bg-mrp-raised px-3 py-2 text-[12.5px] font-semibold text-mrp-text transition-colors hover:border-mrp-red hover:text-mrp-redh"
          >
            <MessageSquarePlus className="size-4 flex-none" />
            <span className="hidden sm:inline">{m.portal_submit_nav()}</span>
          </Link>
          <LangThemeControls compact />
          <span className="mx-1 hidden h-[26px] w-px bg-mrp-border sm:block" />
          <button
            type="button"
            onClick={handleSignOut}
            aria-label={m.portal_signout()}
            className="relative grid size-9 flex-none place-items-center rounded-[9px] border border-mrp-border2 bg-mrp-raised text-mrp-text2 transition-[color,border-color,transform] after:absolute after:-inset-0.5 active:scale-[0.97] hover:border-mrp-red hover:text-mrp-redh sm:hidden"
          >
            <LogOut className="size-4" />
          </button>
          <span className="grid size-9 flex-none place-items-center rounded-full bg-mrp-red text-[13px] font-bold text-white">
            {companyInitials(primary)}
          </span>
          <div className="hidden leading-[1.15] sm:block">
            <div className="text-[13.5px] font-bold">{label}</div>
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
