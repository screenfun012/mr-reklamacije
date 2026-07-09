import { m } from '@mr/i18n'
import { MrEnginesLogo } from '@mr/ui'
import { Menu } from 'lucide-react'

import { useTheme } from '~/lib/theme'
import { UserMenu } from './user-menu'

export interface AdminTopbarProps {
  userEmail: string
  userName: string
  onLogout: () => void
  onToggleSidebar: () => void
}

/**
 * Admin top bar: the ☰ sidebar toggle + brand on the left, the user menu on the
 * right. Spans the full width so the brand stays visible even when the sidebar
 * collapses to a rail or (on mobile) becomes a drawer.
 */
export function AdminTopbar({ userEmail, userName, onLogout, onToggleSidebar }: AdminTopbarProps) {
  const { resolvedTheme } = useTheme()

  return (
    <div className="flex h-full items-center gap-3 px-4 sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={m.nav_menu()}
        className="grid size-9 flex-none place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <MrEnginesLogo theme={resolvedTheme} className="h-7 w-auto" />
      <div className="ml-auto">
        <UserMenu userName={userName} userEmail={userEmail} onLogout={onLogout} />
      </div>
    </div>
  )
}
