import { useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { Heading } from '@mr/ui'

import { authClient } from '~/lib/auth-client'

import { UserMenu } from './user-menu'

export interface PortalShellProps {
  children: ReactNode
}

export function PortalShell({ children }: PortalShellProps) {
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
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <UserMenu userName={userName} userEmail={userEmail} onLogout={handleLogout} />
      </div>

      <main className="container mx-auto max-w-3xl px-6 py-12">
        <div className="text-center mb-12">
          <Heading level="h1">MR Reklamacije</Heading>
          <p className="text-sm text-muted-foreground mt-1">Portal</p>
        </div>

        {children}
      </main>
    </div>
  )
}
