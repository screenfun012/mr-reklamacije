import { m } from '@mr/i18n'
import { LogOut, Shield } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

export function getInitials(name: string, email: string): string {
  const source = (name.trim().length > 0 ? name : email).trim()
  if (source.length === 0) {
    return '?'
  }
  const parts = source.split(/\s+/).filter((part) => part.length > 0)
  const initials =
    parts.length >= 2 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : source.slice(0, 2)
  return initials.toUpperCase()
}

export interface InternalUserChipProps {
  userName: string
  userEmail: string
  /** Localized role name, or undefined to fall back to the email. */
  roleLabel: string | undefined
  onLogout: () => void
}

/**
 * The topbar's user block, shown only when the sidebar is not rendered — which is the
 * case for a user with a single visible nav entry, i.e. a serviser (docs/25 §3.1). The
 * sidebar normally carries the name and the logout, so without this the shop floor would
 * have no way to sign out.
 *
 * Seeing the name is not decoration on a shared workshop tablet: the intake order is bound
 * to whoever is signed in and it is their signature on the printed document, so a serviser
 * must be able to notice at a glance that a colleague is still logged in.
 */
export function InternalUserChip({
  userName,
  userEmail,
  roleLabel,
  onLogout,
}: InternalUserChipProps): ReactElement {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        to="/settings/security"
        title={m.nav_security()}
        className="grid size-9 place-items-center rounded-[9px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-text"
      >
        <Shield className="size-4" aria-hidden="true" />
        <span className="sr-only">{m.nav_security()}</span>
      </Link>

      <span
        aria-hidden="true"
        className="grid size-9 flex-none place-items-center rounded-full bg-mri-red text-[12.5px] font-bold text-white"
      >
        {getInitials(userName, userEmail)}
      </span>

      <div className="hidden min-w-0 leading-tight sm:block">
        <div className="max-w-[180px] truncate text-[13px] font-bold text-mri-text">{userName}</div>
        <div className="max-w-[180px] truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-mri-text2">
          {roleLabel ?? userEmail}
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        title={m.auth_logout()}
        className="grid size-9 cursor-pointer place-items-center rounded-[9px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-redh"
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span className="sr-only">{m.auth_logout()}</span>
      </button>
    </div>
  )
}
