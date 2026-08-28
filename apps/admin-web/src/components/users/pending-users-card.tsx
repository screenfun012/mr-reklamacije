import { m } from '@mr/i18n'
import { getInitials, type UserListItem } from '@mr/shared'
import { panelHeaderClassName, panelMetaClassName, panelTitleClassName } from '@mr/ui'
import type { ReactElement } from 'react'

export interface PendingUsersCardProps {
  users: readonly UserListItem[]
  disabled: boolean
  onApprove: (user: UserListItem) => void
  onReject: (user: UserListItem) => void
}

/**
 * Accounts waiting for a decision — the one card in the panel with a coloured edge, and the reason
 * this screen exists at all.
 *
 * Its own shape rather than a row in the table below: these are two different questions. The table
 * answers "who exists and what do they hold"; this answers "who is standing at the door", so it
 * carries a face, the firm they typed at registration, and the two buttons that decide it.
 */
export function PendingUsersCard({
  users,
  disabled,
  onApprove,
  onReject,
}: PendingUsersCardProps): ReactElement {
  return (
    <section
      aria-labelledby="users-pending-heading"
      className="overflow-hidden rounded-[14px] border border-adm-amb/[0.32] bg-card"
    >
      <div className={panelHeaderClassName}>
        <h2 id="users-pending-heading" className={panelTitleClassName}>
          {m.users_pending_section_title()}
        </h2>
        <span className={panelMetaClassName}>
          {m.admin_catalog_count_total({ total: users.length })}
        </span>
      </div>

      {users.length === 0 ? (
        <p
          className="text-pretty px-6 py-10 text-center text-[13.5px] italic text-muted-foreground"
          role="status"
        >
          {m.users_pending_empty()}
        </p>
      ) : (
        users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center gap-3.5 border-b border-border px-[18px] py-3.5 last:border-b-0"
          >
            <span
              aria-hidden="true"
              className="grid size-[34px] flex-none place-items-center rounded-full bg-adm-amb/15 font-mono text-[11px] font-bold text-adm-amb"
            >
              {getInitials(user.name, user.email)}
            </span>
            <span className="min-w-0 w-[220px]">
              <span className="block truncate text-[13.5px] font-bold text-foreground">
                {user.name}
              </span>
              <span className="block truncate font-mono text-[10.5px] font-medium text-muted-foreground">
                {user.email}
              </span>
            </span>
            {/* The firm the applicant typed at registration. It is a hint, not a link — the approver
                picks the real firm in the dialog — but it is the whole reason to trust the request. */}
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
              {user.requestedCompany === null || user.requestedCompany === ''
                ? null
                : `${m.users_approve_dialog_requested_company_label()}: ${user.requestedCompany}`}
            </span>
            <div className="flex flex-none gap-2">
              <button
                type="button"
                disabled={disabled}
                className="h-[38px] cursor-pointer rounded-[9px] border border-adm-grn/45 bg-adm-grn/[0.14] px-[18px] font-mono text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-adm-grn transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onApprove(user)}
              >
                {m.users_approve_button()}
              </button>
              <button
                type="button"
                disabled={disabled}
                className="h-[38px] cursor-pointer rounded-[9px] border border-mr-brand/40 bg-transparent px-4 font-mono text-[11.5px] font-bold uppercase tracking-[0.06em] text-adm-red-h transition-[background-color,transform] hover:bg-mr-brand/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onReject(user)}
              >
                {m.users_reject_button()}
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  )
}
