import { m } from '@mr/i18n'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { DashCard, DashEmpty } from './dash-card'

export interface NeedsYouCardProps {
  /**
   * Only the three fields the card shows. A whole `UserListItem` would drag twenty more into every
   * test that renders this, for nothing.
   */
  pendingUsers: readonly { id: string; name: string; email: string }[]
}

/**
 * The card that makes the dashboard a place you ACT from rather than a row of figures. The count of
 * waiting accounts was already on the screen — as a number, with no name attached and nothing to
 * click.
 *
 * It is the ONE card on the dashboard with a coloured edge. Amber means a person is blocked until
 * somebody decides; if a second card ever borrows the colour, this one stops meaning anything.
 */
export function NeedsYouCard({ pendingUsers }: NeedsYouCardProps): ReactElement {
  return (
    <DashCard
      title={m.admin_dashboard_needs_you()}
      accent="amber"
      meta={
        <span className="rounded-full bg-adm-amb/15 px-2 py-0.5 font-mono text-[11px] font-bold text-adm-amb">
          {pendingUsers.length}
        </span>
      }
    >
      {pendingUsers.length === 0 ? (
        // An empty queue is good news, and has to say so. A blank panel reads as a screen that
        // failed to load, not as "nothing is waiting".
        <DashEmpty>{m.admin_dashboard_needs_you_empty()}</DashEmpty>
      ) : (
        pendingUsers.map((user) => (
          <Link
            key={user.id}
            to="/users"
            className="flex items-center gap-2.5 rounded-[10px] bg-adm-inbg px-[11px] py-2.5 transition-colors hover:bg-mr-list-item-hover"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-foreground">
                {user.name}
              </span>
              <span className="block truncate font-mono text-[10.5px] font-medium text-muted-foreground">
                {user.email}
              </span>
            </span>
            <span className="flex-none text-[12px] font-bold text-adm-red-h">
              {m.admin_dashboard_open_row()} →
            </span>
          </Link>
        ))
      )}
    </DashCard>
  )
}
