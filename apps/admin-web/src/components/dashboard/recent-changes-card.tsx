import { formatListDateTime, type AuditLogListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import {
  panelClassName,
  panelHeaderClassName,
  panelMetaClassName,
  panelTitleClassName,
} from '@mr/ui'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { AuditActionBadge } from '~/components/audit/audit-action-badge'
import { auditEntityTypeLabel } from '~/components/audit/audit-labels'

/** Six rows: enough to see what the system has been doing, short enough to read without scrolling. */
const SHOWN = 6

export interface RecentChangesCardProps {
  items: readonly AuditLogListItem[]
}

/**
 * What the system has been doing lately, beside what is waiting for you. No count in the header:
 * the audit list is an infinite query, so it knows how many rows it has PULLED rather than how many
 * exist, and a number that climbs as you scroll is worse than none.
 */
export function RecentChangesCard({ items }: RecentChangesCardProps): ReactElement {
  const shown = items.slice(0, SHOWN)

  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>{m.admin_dashboard_recent_changes()}</h2>
        <Link to="/audit" className={`${panelMetaClassName} hover:text-foreground`}>
          {m.admin_dashboard_see_all()} →
        </Link>
      </div>
      <div className="flex flex-col gap-1 p-3">
        {shown.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {m.admin_dashboard_recent_changes_empty()}
          </p>
        ) : (
          shown.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-md px-2 py-2">
              <AuditActionBadge action={item.action} />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {auditEntityTypeLabel(item.entityType)}
                {' · '}
                <span className="text-muted-foreground">
                  {item.actor?.name ?? m.audit_actor_system()}
                </span>
              </span>
              <span className="flex-none font-mono text-[11px] text-muted-foreground">
                {formatListDateTime(item.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
