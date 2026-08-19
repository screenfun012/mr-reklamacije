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
  // Chips, not coloured words: a diff is two VALUES, and at 12px mono in a tinted box the eye finds
  // the pair without reading the sentence around it (prototype's expanded audit row).
  const beforeChip = (
    <span className="rounded-md bg-mr-brand/10 px-2 py-0.5 font-mono text-adm-red-h line-through">
      {before}
    </span>
  )
  const afterChip = (
    <span className="rounded-md bg-adm-grn/[0.13] px-2 py-0.5 font-mono text-adm-grn">{after}</span>
  )

  if (before !== null && after !== null) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {beforeChip}
        <span className="text-muted-foreground">→</span>
        {afterChip}
      </span>
    )
  }
  if (after !== null) {
    return afterChip
  }
  if (before !== null) {
    return beforeChip
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
    <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-[11px]">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
