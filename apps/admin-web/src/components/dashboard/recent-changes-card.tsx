import { formatListDateTime, type AuditLogListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { AuditActionBadge } from '~/components/audit/audit-action-badge'
import { auditEntityTypeLabel } from '~/components/audit/audit-labels'

import { DashCard, DashEmpty, DashRow } from './dash-card'

/** Five rows: enough to see what the system has been doing, short enough to read without scrolling. */
const SHOWN = 5

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
    <DashCard
      title={m.admin_dashboard_recent_changes()}
      meta={
        <Link
          to="/audit"
          className="text-[12px] font-bold text-adm-red-h transition-opacity hover:opacity-80"
        >
          {m.admin_dashboard_see_all()} →
        </Link>
      }
    >
      {shown.length === 0 ? (
        <DashEmpty>{m.admin_dashboard_recent_changes_empty()}</DashEmpty>
      ) : (
        shown.map((item) => (
          <DashRow key={item.id}>
            <AuditActionBadge action={item.action} />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
              {auditEntityTypeLabel(item.entityType)}
              {' · '}
              <span className="text-muted-foreground">
                {item.actor?.name ?? m.audit_actor_system()}
              </span>
            </span>
            <span className="flex-none font-mono text-[10px] font-medium text-muted-foreground">
              {formatListDateTime(item.createdAt)}
            </span>
          </DashRow>
        ))
      )}
    </DashCard>
  )
}
