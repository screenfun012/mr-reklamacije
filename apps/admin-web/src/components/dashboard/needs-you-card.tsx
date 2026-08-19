import { m } from '@mr/i18n'
import {
  panelClassName,
  panelHeaderClassName,
  panelMetaClassName,
  panelTitleClassName,
} from '@mr/ui'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

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
 */
export function NeedsYouCard({ pendingUsers }: NeedsYouCardProps): ReactElement {
  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>{m.admin_dashboard_needs_you()}</h2>
        <span className={panelMetaClassName}>
          {m.admin_catalog_count_total({ total: pendingUsers.length })}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-3">
        {pendingUsers.length === 0 ? (
          // An empty queue is good news, and has to say so. A blank panel reads as a screen that
          // failed to load, not as "nothing is waiting".
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {m.admin_dashboard_needs_you_empty()}
          </p>
        ) : (
          pendingUsers.map((user) => (
            <Link
              key={user.id}
              to="/users"
              className="flex flex-col rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
            >
              <span className="text-sm font-medium text-foreground">{user.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{user.email}</span>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}
