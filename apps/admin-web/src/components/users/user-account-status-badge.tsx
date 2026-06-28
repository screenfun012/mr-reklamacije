import { UserAccountStatus, type UserAccountStatus as UserAccountStatusValue } from '@mr/shared'
import { m } from '@mr/i18n'
import { BADGE_SHELL_CLASSES } from '@mr/ui'
import type { ReactElement } from 'react'

const STATUS_LABEL: Record<UserAccountStatusValue, () => string> = {
  [UserAccountStatus.Pending]: () => m.users_status_pending(),
  [UserAccountStatus.Approved]: () => m.users_status_approved(),
  [UserAccountStatus.Rejected]: () => m.users_status_rejected(),
}

/** Status badge colors via brandbook mr-* tokens (same class shape as OUTCOME_BADGE_CLASSES). */
const STATUS_CLASSES: Record<UserAccountStatusValue, string> = {
  [UserAccountStatus.Pending]:
    'border-mr-warning/45 bg-mr-warning-subtle text-mr-warning-strong shadow-sm shadow-mr-warning/15 dark:border-mr-warning/55 dark:bg-mr-warning/20 dark:text-mr-warning dark:shadow-mr-warning/10',
  [UserAccountStatus.Approved]:
    'border-mr-success/45 bg-mr-success-subtle text-mr-success-strong shadow-sm shadow-mr-success/15 dark:border-mr-success/55 dark:bg-mr-success/20 dark:text-mr-success dark:shadow-mr-success/10',
  [UserAccountStatus.Rejected]:
    'border-mr-error/45 bg-mr-error-subtle text-mr-error-strong shadow-sm shadow-mr-error/15 dark:border-mr-error/55 dark:bg-mr-error/20 dark:text-mr-error dark:shadow-mr-error/10',
}

export interface UserAccountStatusBadgeProps {
  status: UserAccountStatusValue
}

export function UserAccountStatusBadge({ status }: UserAccountStatusBadgeProps): ReactElement {
  return (
    <span className={`${BADGE_SHELL_CLASSES} ${STATUS_CLASSES[status]}`}>
      {STATUS_LABEL[status]()}
    </span>
  )
}
