import { UserAccountStatus, type UserAccountStatus as UserAccountStatusValue } from '@mr/shared'
import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

const STATUS_LABEL: Record<UserAccountStatusValue, () => string> = {
  [UserAccountStatus.Pending]: () => m.users_status_pending(),
  [UserAccountStatus.Approved]: () => m.users_status_approved(),
  [UserAccountStatus.Rejected]: () => m.users_status_rejected(),
}

/**
 * A tinted pill with a dot in the same hue, as the prototype draws every state in this panel. The
 * dot is what makes the three tell each other apart at a glance in a column of twenty rows — the
 * word is for reading, the dot for scanning.
 */
const STATUS_CLASSES: Record<UserAccountStatusValue, string> = {
  [UserAccountStatus.Pending]: 'bg-adm-amb/15 text-adm-amb',
  [UserAccountStatus.Approved]: 'bg-adm-grn/15 text-adm-grn',
  [UserAccountStatus.Rejected]: 'bg-mr-brand/[0.13] text-adm-red-h',
}

export interface UserAccountStatusBadgeProps {
  status: UserAccountStatusValue
}

export function UserAccountStatusBadge({ status }: UserAccountStatusBadgeProps): ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] ${STATUS_CLASSES[status]}`}
    >
      <span aria-hidden="true" className="size-[5px] rounded-full bg-current" />
      {STATUS_LABEL[status]()}
    </span>
  )
}
