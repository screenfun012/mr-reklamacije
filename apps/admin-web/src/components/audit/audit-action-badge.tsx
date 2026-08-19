import { AuditAction } from '@mr/shared'
import type { ReactElement } from 'react'

import { auditActionLabel } from './audit-labels'

/**
 * Action → hue, as the prototype draws them (`admin-prototip.dc.html`): a tinted pill with no
 * border and no shadow, in mono caps.
 *
 * Mutations get semantic colours, auth events stay grey, and export/import take the purple that
 * means "left the building" here and on the claim-kind badges. Red belongs to deletion alone —
 * on a screen that is one long list of actions, a red that also meant "created" would mean nothing.
 */
const ACTION_CLASSES: Record<string, string> = {
  [AuditAction.Create]: 'bg-adm-grn/15 text-adm-grn',
  [AuditAction.Update]: 'bg-adm-blu/15 text-adm-blu',
  [AuditAction.Delete]: 'bg-mr-brand/[0.13] text-adm-red-h',
  [AuditAction.Restore]: 'bg-adm-teal/15 text-adm-teal',
  [AuditAction.PermissionChange]: 'bg-adm-amb/15 text-adm-amb',
  [AuditAction.Login]: 'bg-adm-gry/20 text-adm-gry',
  [AuditAction.Logout]: 'bg-adm-gry/20 text-adm-gry',
  [AuditAction.Export]: 'bg-adm-pur/15 text-adm-pur',
  [AuditAction.Import]: 'bg-adm-pur/15 text-adm-pur',
}

const NEUTRAL = 'bg-adm-gry/20 text-adm-gry'

export interface AuditActionBadgeProps {
  action: string
}

export function AuditActionBadge({ action }: AuditActionBadgeProps): ReactElement {
  const className = ACTION_CLASSES[action] ?? NEUTRAL
  return (
    <span
      className={`flex-none rounded-full px-2 py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.06em] ${className}`}
    >
      {auditActionLabel(action)}
    </span>
  )
}
