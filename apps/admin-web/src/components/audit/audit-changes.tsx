import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

import { humanizeAuditChanges } from './audit-humanize'

const MAX_SUMMARY_LINES = 4

function DiffValue({
  before,
  after,
}: {
  before: string | null
  after: string | null
}): ReactElement {
  if (before !== null && after !== null) {
    return (
      <span>
        <span className="text-mr-error-strong line-through">{before}</span>
        {' → '}
        <span className="text-mr-success-strong">{after}</span>
      </span>
    )
  }
  if (after !== null) {
    return <span>{after}</span>
  }
  if (before !== null) {
    return <span className="text-mr-error-strong line-through">{before}</span>
  }
  return <span className="text-muted-foreground">—</span>
}

export interface AuditChangesProps {
  changes: unknown
}

export function AuditChanges({ changes }: AuditChangesProps): ReactElement {
  const summary = humanizeAuditChanges(changes)

  if (summary.kind === 'empty') {
    return <span className="text-muted-foreground">—</span>
  }

  if (summary.kind === 'sentence') {
    return <span className="text-sm">{summary.text}</span>
  }

  const visible = summary.lines.slice(0, MAX_SUMMARY_LINES)
  const overflow = summary.lines.length - visible.length

  return (
    <ul className="space-y-0.5">
      {visible.map((line, index) => (
        <li key={`${line.label}-${index}`} className="text-xs">
          <span className="font-medium">{line.label}</span>
          {': '}
          {summary.kind === 'diff' ? (
            <DiffValue before={line.before} after={line.after} />
          ) : (
            <span>{line.after ?? '—'}</span>
          )}
        </li>
      ))}
      {overflow > 0 ? <li className="text-xs text-muted-foreground">+{overflow}…</li> : null}
    </ul>
  )
}

export interface AuditJsonProps {
  value: unknown
}

export function AuditJson({ value }: AuditJsonProps): ReactElement {
  if (value === null || value === undefined) {
    return <p className="text-xs text-muted-foreground">{m.audit_detail_none()}</p>
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
