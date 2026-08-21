import {
  customersReferenceOptions,
  EMOTIVE_PARTNER_CUSTOMERS_REFERENCE,
  type UserListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactElement } from 'react'

import {
  admLabelClassName,
  admPrimaryButtonClassName,
  admSecondaryButtonClassName,
} from '~/lib/adm-chrome'

interface UserCustomersEditDialogProps {
  user: UserListItem | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (user: UserListItem, customerIds: string[]) => void
}

/**
 * Which firms a client account speaks for — changeable after approval.
 *
 * Until this existed the link could only be written inside the approve transaction, so an
 * account approved onto the wrong firm could be corrected only in SQL, and the portal kept
 * showing that firm's engines to somebody who had nothing to do with it (2026-08-21).
 *
 * At least one firm stays required, as at approval: a client with no link opens a portal that
 * can show them nothing.
 */
export function UserCustomersEditDialog({
  user,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: UserCustomersEditDialogProps): ReactElement {
  // Not suspense: this dialog is mounted by the users screen and must never hold its render.
  const { data: customers } = useQuery({
    ...customersReferenceOptions(EMOTIVE_PARTNER_CUSTOMERS_REFERENCE),
    enabled: open,
  })

  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (user !== null && open) {
      setSelected(user.customers.map((customer) => customer.id))
    }
  }, [user, open])

  const toggle = (id: string): void => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && user !== null) {
      setSelected(user.customers.map((customer) => customer.id))
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{m.users_customers_edit_dialog_title()}</DialogTitle>
          {user !== null ? (
            <DialogDescription>
              {m.users_customers_edit_dialog_description({ name: user.name, email: user.email })}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className={admLabelClassName}>
            {m.users_customers_edit_dialog_firms_label()}
          </legend>
          <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
            {(customers ?? []).map((customer) => (
              <label
                key={customer.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-adm-border bg-adm-inbg px-3 py-2 text-[13px] text-adm-text"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(customer.id)}
                  disabled={pending}
                  onChange={() => toggle(customer.id)}
                />
                {customer.name}
              </label>
            ))}
          </div>
        </fieldset>

        <DialogFooter className="gap-2.5 sm:justify-stretch">
          <button
            type="button"
            className={admSecondaryButtonClassName}
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {m.action_cancel()}
          </button>
          <button
            type="button"
            className={admPrimaryButtonClassName}
            disabled={pending || user === null || selected.length === 0}
            onClick={() => {
              if (user !== null && selected.length > 0) {
                onConfirm(user, selected)
              }
            }}
          >
            {m.users_customers_edit_dialog_confirm()}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
