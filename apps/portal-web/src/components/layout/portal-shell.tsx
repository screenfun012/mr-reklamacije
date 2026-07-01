import { Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { m } from '@mr/i18n'

import { authClient } from '~/lib/auth-client'

import { UserMenu } from './user-menu'

export interface PortalShellProps {
  children: ReactNode
  /** Customer/company label for the account chip (derived from the claims list). */
  company?: string | undefined
}

export function PortalShell({ children, company }: PortalShellProps) {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  const handleLogout = (): void => {
    void (async () => {
      await authClient.signOut()
      await navigate({ to: '/login' })
    })()
  }

  const userEmail = session?.user.email ?? ''
  const userName = session?.user.name ?? userEmail

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-7 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img src="/mr-crest.png" alt="MR Engines" className="h-8 w-auto" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mr-text-tertiary">
              {m.portal_nav_brand()}
            </span>
          </Link>
          <UserMenu
            userName={userName}
            userEmail={userEmail}
            company={company}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-7 pb-24 pt-9">{children}</main>
    </div>
  )
}
