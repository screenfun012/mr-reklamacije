import { formatListDateTime, type AuditLogListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { dataTableRowHoverOnlyClassName } from '@mr/ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useState, type ReactElement } from 'react'

import { AuditActionBadge } from './audit-action-badge'
import { AuditChanges, AuditJson } from './audit-changes'
import { auditEntityTypeLabel } from './audit-labels'

function AuditDetail({ item }: { item: AuditLogListItem }): ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{m.audit_detail_ip()}</p>
          <p className="font-mono text-xs">{item.actorIp ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{m.audit_detail_user_agent()}</p>
          <p className="break-all text-xs">{item.actorUserAgent ?? '—'}</p>
        </div>
      </div>
      <div className="space-y-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {m.audit_detail_changes()}
          </p>
          <AuditJson value={item.changes} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
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
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              <th className="w-10 px-4 py-3" aria-hidden="true" />
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.audit_col_time()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.audit_col_actor()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.audit_col_action()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.audit_col_entity()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.audit_col_changes()}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isOpen = expanded.has(item.id)
              return (
                <Fragment key={item.id}>
                  <tr className={dataTableRowHoverOnlyClassName}>
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? m.audit_expand_hide() : m.audit_expand_show()}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-muted-foreground">
                      {formatListDateTime(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {item.actor !== null ? (
                        <div>
                          <div className="font-medium">{item.actor.name}</div>
                          <div className="text-xs text-muted-foreground">{item.actor.email}</div>
                        </div>
                      ) : (
                        <span className="italic text-muted-foreground">
                          {m.audit_actor_system()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <AuditActionBadge action={item.action} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{auditEntityTypeLabel(item.entityType)}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {item.entityId.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <AuditChanges changes={item.changes} />
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-border bg-muted/10">
                      <td aria-hidden="true" />
                      <td colSpan={5} className="px-4 py-4">
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
