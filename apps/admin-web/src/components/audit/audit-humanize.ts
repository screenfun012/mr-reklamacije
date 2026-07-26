import { m } from '@mr/i18n'

/** One human-readable change line. `before === null` means "current value", not a diff. */
export interface AuditFriendlyLine {
  label: string
  before: string | null
  after: string | null
}

export type AuditSummary =
  | { kind: 'sentence'; text: string }
  | { kind: 'diff'; lines: AuditFriendlyLine[] }
  | { kind: 'values'; lines: AuditFriendlyLine[] }
  | { kind: 'empty' }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Technical/noise keys that mean nothing to an admin (and *Id UUIDs). */
const HIDDEN_KEYS = new Set([
  'id',
  'kind',
  'usageCount',
  'faults',
  'createdAt',
  'updatedAt',
  'deletedAt',
])

function isHiddenKey(key: string): boolean {
  return HIDDEN_KEYS.has(key) || key.endsWith('Id')
}

const FIELD_LABELS: Record<string, () => string> = {
  name: () => m.audit_field_name(),
  code: () => m.audit_field_code(),
  country: () => m.audit_field_country(),
  city: () => m.audit_field_city(),
  isActive: () => m.audit_field_active(),
  sortOrder: () => m.audit_field_sort_order(),
  accountStatus: () => m.audit_field_account_status(),
  roles: () => m.audit_field_roles(),
  outcome: () => m.audit_field_outcome(),
  mrNumber: () => m.audit_field_mr_number(),
  claimYear: () => m.audit_field_claim_year(),
  displacementCc: () => m.audit_field_displacement(),
  notes: () => m.audit_field_notes(),
}

function fieldLabel(key: string): string {
  return (FIELD_LABELS[key] ?? (() => key))()
}

const STATUS_VALUE_LABELS: Record<string, () => string> = {
  pending: () => m.users_status_pending(),
  approved: () => m.users_status_approved(),
  rejected: () => m.users_status_rejected(),
}

const OUTCOME_VALUE_LABELS: Record<string, () => string> = {
  pending: () => m.outcome_pending(),
  accepted: () => m.outcome_accepted(),
  rejected: () => m.outcome_rejected(),
  archived: () => m.outcome_archived(),
}

const ROLE_VALUE_LABELS: Record<string, () => string> = {
  admin: () => m.users_role_admin(),
  operator: () => m.users_role_operator(),
  viewer: () => m.users_role_viewer(),
  client: () => m.users_role_client(),
  serviser: () => m.users_role_serviser(),
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'boolean') {
    return value ? m.audit_value_yes() : m.audit_value_no()
  }
  if (key === 'accountStatus' && typeof value === 'string') {
    return (STATUS_VALUE_LABELS[value] ?? (() => value))()
  }
  if (key === 'outcome' && typeof value === 'string') {
    return (OUTCOME_VALUE_LABELS[value] ?? (() => value))()
  }
  if (key === 'roles' && Array.isArray(value)) {
    if (value.length === 0) {
      return '—'
    }
    return value
      .map((role) => (ROLE_VALUE_LABELS[String(role)] ?? (() => String(role)))())
      .join(', ')
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return JSON.stringify(value)
}

/** Fields worth showing for snapshot-only payloads (create / after-only update / delete). */
const IDENTIFYING_KEYS = ['mrNumber', 'outcome', 'name', 'code', 'accountStatus'] as const

function snapshotLines(snapshot: Record<string, unknown>): AuditFriendlyLine[] {
  const lines: AuditFriendlyLine[] = []
  for (const key of IDENTIFYING_KEYS) {
    if (!(key in snapshot)) {
      continue
    }
    const value = snapshot[key]
    if (value === null || value === undefined) {
      continue
    }
    lines.push({ label: fieldLabel(key), before: null, after: formatValue(key, value) })
  }
  return lines
}

/**
 * Turns a free-form `changes` payload into admin-readable text. Defensive:
 * unknown shapes still render (raw keys as labels), never assumes a schema.
 */
export function humanizeAuditChanges(changes: unknown): AuditSummary {
  if (changes === null || changes === undefined) {
    return { kind: 'empty' }
  }

  if (!isPlainObject(changes)) {
    return { kind: 'sentence', text: formatValue('', changes) }
  }

  // Special payload: admin-initiated password reset.
  if (changes['field'] === 'password') {
    return { kind: 'sentence', text: m.audit_summary_password_reset() }
  }

  const before = isPlainObject(changes['before']) ? changes['before'] : null
  const after = isPlainObject(changes['after']) ? changes['after'] : null

  if (before !== null && after !== null) {
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
      (key) => !isHiddenKey(key),
    )
    const lines: AuditFriendlyLine[] = []
    for (const key of keys) {
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) {
        continue
      }
      lines.push({
        label: fieldLabel(key),
        before: key in before ? formatValue(key, before[key]) : null,
        after: key in after ? formatValue(key, after[key]) : null,
      })
    }
    return lines.length === 0 ? { kind: 'empty' } : { kind: 'diff', lines }
  }

  const snapshot = after ?? before
  if (snapshot !== null) {
    const lines = snapshotLines(snapshot)
    return lines.length === 0 ? { kind: 'empty' } : { kind: 'values', lines }
  }

  // Flat unknown object — surface non-noise scalar entries.
  const lines: AuditFriendlyLine[] = []
  for (const [key, value] of Object.entries(changes)) {
    if (isHiddenKey(key)) {
      continue
    }
    lines.push({ label: fieldLabel(key), before: null, after: formatValue(key, value) })
  }
  return lines.length === 0 ? { kind: 'empty' } : { kind: 'values', lines }
}
