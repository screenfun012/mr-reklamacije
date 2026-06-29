import { AuditAction } from '@mr/shared'
import { BADGE_SHELL_CLASSES } from '@mr/ui'
import type { ReactElement } from 'react'

import { auditActionLabel } from './audit-labels'

const SUCCESS =
  'border-mr-success/45 bg-mr-success-subtle text-mr-success-strong shadow-sm shadow-mr-success/15 dark:border-mr-success/55 dark:bg-mr-success/20 dark:text-mr-success dark:shadow-mr-success/10'
const INFO =
  'border-mr-info/45 bg-mr-info-subtle text-mr-info-strong shadow-sm shadow-mr-info/15 dark:border-mr-info/55 dark:bg-mr-info/20 dark:text-mr-info dark:shadow-mr-info/10'
const ERROR =
  'border-mr-error/45 bg-mr-error-subtle text-mr-error-strong shadow-sm shadow-mr-error/15 dark:border-mr-error/55 dark:bg-mr-error/20 dark:text-mr-error dark:shadow-mr-error/10'
const ACCENT =
  'border-mr-accent/45 bg-mr-accent-subtle text-mr-accent-strong shadow-sm shadow-mr-accent/15 dark:border-mr-accent/55 dark:bg-mr-accent/20 dark:text-mr-accent dark:shadow-mr-accent/10'
const WARNING =
  'border-mr-warning/45 bg-mr-warning-subtle text-mr-warning-strong shadow-sm shadow-mr-warning/15 dark:border-mr-warning/55 dark:bg-mr-warning/20 dark:text-mr-warning dark:shadow-mr-warning/10'
const NEUTRAL =
  'border-mr-neutral-border bg-mr-neutral-subtle text-mr-neutral-muted shadow-sm dark:border-mr-neutral-muted/45 dark:bg-mr-neutral-muted/20 dark:text-mr-neutral-border'

/** Action → brandbook hue. Mutations get semantic colors; auth/io events stay neutral. */
const ACTION_CLASSES: Record<string, string> = {
  [AuditAction.Create]: SUCCESS,
  [AuditAction.Update]: INFO,
  [AuditAction.Delete]: ERROR,
  [AuditAction.Restore]: ACCENT,
  [AuditAction.PermissionChange]: WARNING,
  [AuditAction.Login]: NEUTRAL,
  [AuditAction.Logout]: NEUTRAL,
  [AuditAction.Export]: NEUTRAL,
  [AuditAction.Import]: NEUTRAL,
}

export interface AuditActionBadgeProps {
  action: string
}

export function AuditActionBadge({ action }: AuditActionBadgeProps): ReactElement {
  const className = ACTION_CLASSES[action] ?? NEUTRAL
  return <span className={`${BADGE_SHELL_CLASSES} ${className}`}>{auditActionLabel(action)}</span>
}
