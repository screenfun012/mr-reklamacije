import { setLocale } from '@mr/i18n'
import { beforeEach, describe, expect, it } from 'vitest'

import { humanizeAuditChanges } from '../audit-humanize'

describe('humanizeAuditChanges', () => {
  // These assertions are on Serbian labels, so the locale must be stated rather
  // than inherited — it used to fall out of the node test environment, which is
  // not a guarantee (internal-web and portal-web set it in every test).
  beforeEach(() => {
    setLocale('sr')
  })

  it('returns empty for null changes', () => {
    expect(humanizeAuditChanges(null)).toEqual({ kind: 'empty' })
  })

  it('renders the admin password reset as a friendly sentence', () => {
    const result = humanizeAuditChanges({ field: 'password', action: 'admin_reset' })
    expect(result).toEqual({ kind: 'sentence', text: 'Resetovana lozinka' })
  })

  it('diffs before/after with friendly labels and values', () => {
    const result = humanizeAuditChanges({
      before: { roles: [], accountStatus: 'pending' },
      after: { roles: ['operator'], accountStatus: 'approved' },
    })

    expect(result.kind).toBe('diff')
    if (result.kind !== 'diff') {
      return
    }

    const status = result.lines.find((line) => line.label === 'Status naloga')
    expect(status).toEqual({ label: 'Status naloga', before: 'Na čekanju', after: 'Odobren' })

    const roles = result.lines.find((line) => line.label === 'Uloge')
    expect(roles).toEqual({ label: 'Uloge', before: '—', after: 'Operater' })
  })

  it('formats booleans as Da/Ne and hides noise keys', () => {
    const result = humanizeAuditChanges({
      before: { isActive: true, usageCount: 3, id: 'abc' },
      after: { isActive: false, usageCount: 4, id: 'abc' },
    })

    expect(result.kind).toBe('diff')
    if (result.kind !== 'diff') {
      return
    }

    // usageCount + id are noise → only isActive surfaces.
    expect(result.lines).toEqual([{ label: 'Aktivno', before: 'Da', after: 'Ne' }])
  })

  it('shows identifying values for an after-only snapshot', () => {
    const result = humanizeAuditChanges({
      after: { id: 'x', kind: 'domace', faults: [], outcome: 'pending', mrNumber: 'UNI-DO/26' },
    })

    expect(result.kind).toBe('values')
    if (result.kind !== 'values') {
      return
    }

    expect(result.lines).toEqual([
      { label: 'MR broj', before: null, after: 'UNI-DO/26' },
      { label: 'Ishod', before: null, after: 'U obradi' },
    ])
  })

  it('falls back to raw keys for unknown shapes (defensive)', () => {
    const result = humanizeAuditChanges({ somethingNew: 'value' })
    expect(result).toEqual({
      kind: 'values',
      lines: [{ label: 'somethingNew', before: null, after: 'value' }],
    })
  })
})
