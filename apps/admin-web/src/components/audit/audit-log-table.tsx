import { formatListDateTime, type AuditLogListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import {
  dataTableCardClassName,
  dataTableCellClassName,
  dataTableHeadRowClassName,
  dataTableRowHoverOnlyClassName,
} from '@mr/ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useState, type ReactElement } from 'react'

import { admTableHeadCellClassName, admTableScrollClassName } from '~/lib/adm-chrome'
import { AuditActionBadge } from './audit-action-badge'
import { AuditChanges, AuditJson } from './audit-changes'
import { auditEntityTypeLabel } from './audit-labels'

function AuditDetail({ item }: { item: AuditLogListItem }): ReactElement {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Who and from where, on one mono line — the prototype's shape. These three are the whole
          reason an audit row is opened: the rest is the payload beneath. */}
      <div className="flex flex-wrap gap-x-7 gap-y-1 font-mono text-[11px] font-medium text-muted-foreground">
        <span>
          {m.audit_detail_ip()}: {item.actorIp ?? '—'}
        </span>
        <span className="max-w-full break-all">{item.actorUserAgent ?? '—'}</span>
      </div>

      {/* `min-w-0` on both cells: without it a long JSON line sets the column's width and the
          payload runs out past the card's right edge instead of scrolling inside its own box. */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {m.audit_detail_changes()}
          </p>
          <AuditJson value={item.changes} />
        </div>
        <div className="min-w-0">
          <p className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {m.audit_detail_context()}
          </p>
          <AuditJson value={item.context} />
        </div>
      </div>
    </div>
  )
}

export interface AuditLogTableProps {
  items: readonly AuditLogListItem[]
}

export function AuditLogTable({ items }: AuditLogTableProps): ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const toggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className={dataTableCardClassName}>
      <div className={admTableScrollClassName}>
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className={dataTableHeadRowClassName}>
              <th className={`${admTableHeadCellClassName} w-10`} aria-hidden="true" />
              <th className={admTableHeadCellClassName}>{m.audit_col_time()}</th>
              <th className={admTableHeadCellClassName}>{m.audit_col_actor()}</th>
              <th className={admTableHeadCellClassName}>{m.audit_col_action()}</th>
              <th className={admTableHeadCellClassName}>{m.audit_col_entity()}</th>
              <th className={admTableHeadCellClassName}>{m.audit_col_changes()}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isOpen = expanded.has(item.id)
              return (
                <Fragment key={item.id}>
                  <tr className={dataTableRowHoverOnlyClassName}>
                    <td className={`${dataTableCellClassName} align-top`}>
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? m.audit_expand_hide() : m.audit_expand_show()}
                        className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                    </td>
                    <td
                      className={`${dataTableCellClassName} whitespace-nowrap align-top font-mono text-[11.5px] font-medium text-muted-foreground`}
                    >
                      {formatListDateTime(item.createdAt)}
                    </td>
                    <td className={`${dataTableCellClassName} align-top`}>
                      {item.actor !== null ? (
                        <div>
                          <div className="text-[13px] font-semibold">{item.actor.name}</div>
                          <div className="font-mono text-[10.5px] text-muted-foreground">
                            {item.actor.email}
                          </div>
                        </div>
                      ) : (
                        <span className="italic text-muted-foreground">
                          {m.audit_actor_system()}
                        </span>
                      )}
                    </td>
                    <td className={`${dataTableCellClassName} align-top`}>
                      <AuditActionBadge action={item.action} />
                    </td>
                    <td className={`${dataTableCellClassName} align-top`}>
                      <div className="text-[12.5px] font-medium">
                        {auditEntityTypeLabel(item.entityType)}
                      </div>
                      <div className="font-mono text-[10.5px] text-muted-foreground">
                        {item.entityId.slice(0, 8)}
                      </div>
                    </td>
                    <td className={`${dataTableCellClassName} align-top`}>
                      <AuditChanges changes={item.changes} />
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-border bg-adm-inbg">
                      <td aria-hidden="true" />
                      <td colSpan={5} className="px-[18px] pb-4 pt-3.5">
                        <AuditDetail item={item} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
