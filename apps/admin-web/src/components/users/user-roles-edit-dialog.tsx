import { rolesListOptions, type UserListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useLocale,
} from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactElement } from 'react'

import {
  admLabelClassName,
  admPrimaryButtonClassName,
  admSecondaryButtonClassName,
} from '~/lib/adm-chrome'
import { toAssignableRoles } from './assignable-roles'
import { RolePackagePicker } from './role-package-picker'

/**
 * What the person already holds, minus anything this dialog cannot hand back. Starting from their
 * real roles matters more than it did with three fixed codes: somebody can now hold several small
 * sets, and an editor that silently dropped the ones it did not recognise would take them away on
 * the next save.
 */
function initialSelectedRoles(
  held: readonly string[],
  assignable: readonly { code: string }[],
): string[] {
  const codes = new Set(assignable.map((role) => role.code))
  return held.filter((role) => codes.has(role)).sort()
}

interface UserRolesEditDialogProps {
  user: UserListItem | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (user: UserListItem, roleCodes: string[]) => void
}

export function UserRolesEditDialog({
  user,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: UserRolesEditDialogProps): ReactElement {
  const { locale } = useLocale()
  // Not suspense: the dialog is mounted by the users screen and must not hold its render.
  const { data: roles } = useQuery({ ...rolesListOptions(), enabled: open })
  const assignable = useMemo(() => toAssignableRoles(roles ?? [], locale), [roles, locale])

  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  useEffect(() => {
    if (user !== null && open) {
      setSelectedRoles(initialSelectedRoles(user.roles, assignable))
    }
  }, [user, open, assignable])

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && user !== null) {
      setSelectedRoles(initialSelectedRoles(user.roles, assignable))
    }
    onOpenChange(nextOpen)
  }

  const toggleRole = (role: string): void => {
    setSelectedRoles((current) => {
      if (current.includes(role)) {
        const next = current.filter((code) => code !== role)
        return next.length > 0 ? next : current
      }

      return [...current, role].sort()
    })
  }

  const handleConfirm = (): void => {
    if (user === null || selectedRoles.length === 0) {
      return
    }

    onConfirm(user, selectedRoles)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{m.users_roles_edit_dialog_title()}</DialogTitle>
          {user !== null ? (
            <DialogDescription>
              {m.users_roles_edit_dialog_description({ name: user.name, email: user.email })}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className={admLabelClassName}>{m.users_roles_edit_dialog_roles_label()}</legend>
          <RolePackagePicker
            options={assignable}
            selected={selectedRoles}
            disabled={pending}
            onToggle={toggleRole}
          />
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
            disabled={pending || user === null || selectedRoles.length === 0}
            onClick={handleConfirm}
          >
            {m.users_roles_edit_dialog_confirm()}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
