import { UserAccountStatus, type UserAccountStatus as UserAccountStatusValue } from '@mr/shared'
import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

const BADGE_SHELL = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium'

const STATUS_LABEL: Record<UserAccountStatusValue, () => string> = {
  [UserAccountStatus.Pending]: () => m.users_status_pending(),
  [UserAccountStatus.Approved]: () => m.users_status_approved(),
  [UserAccountStatus.Rejected]: () => m.users_status_rejected(),
}

const STATUS_CLASSES: Record<UserAccountStatusValue, string> = {
  [UserAccountStatus.Pending]:
    'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  [UserAccountStatus.Approved]:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  [UserAccountStatus.Rejected]: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200',
}

export interface UserAccountStatusBadgeProps {
  status: UserAccountStatusValue
}

export function UserAccountStatusBadge({ status }: UserAccountStatusBadgeProps): ReactElement {
  return (
    <span className={`${BADGE_SHELL} ${STATUS_CLASSES[status]}`}>{STATUS_LABEL[status]()}</span>
  )
}
