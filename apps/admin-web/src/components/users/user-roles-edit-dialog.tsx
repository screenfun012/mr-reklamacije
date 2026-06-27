import {
  APPROVE_REGISTRATION_ROLE_CODES,
  DEFAULT_APPROVE_REGISTRATION_ROLE,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  type ApproveRegistrationRoleCode,
  type UserListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mr/ui'
import { useEffect, useState, type ReactElement } from 'react'

const EDITABLE_ROLE_OPTIONS = [
  { value: SYSTEM_ROLE_OPERATOR, label: () => m.users_role_operator() },
  { value: SYSTEM_ROLE_VIEWER, label: () => m.users_role_viewer() },
] as const satisfies ReadonlyArray<{
  value: ApproveRegistrationRoleCode
  label: () => string
}>

function initialSelectedRoles(roles: readonly string[]): ApproveRegistrationRoleCode[] {
  const assignable = roles.filter((role): role is ApproveRegistrationRoleCode =>
    (APPROVE_REGISTRATION_ROLE_CODES as readonly string[]).includes(role),
  )

  if (assignable.length > 0) {
    return assignable
  }

  return [DEFAULT_APPROVE_REGISTRATION_ROLE]
}

interface UserRolesEditDialogProps {
  user: UserListItem | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (user: UserListItem, roleCodes: ApproveRegistrationRoleCode[]) => void
}

export function UserRolesEditDialog({
  user,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: UserRolesEditDialogProps): ReactElement {
  const [selectedRoles, setSelectedRoles] = useState<ApproveRegistrationRoleCode[]>([
    DEFAULT_APPROVE_REGISTRATION_ROLE,
  ])

  useEffect(() => {
    if (user !== null && open) {
      setSelectedRoles(initialSelectedRoles(user.roles))
    }
  }, [user, open])

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen && user !== null) {
      setSelectedRoles(initialSelectedRoles(user.roles))
    }
    onOpenChange(nextOpen)
  }

  const toggleRole = (role: ApproveRegistrationRoleCode): void => {
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{m.users_roles_edit_dialog_title()}</DialogTitle>
          {user !== null ? (
            <DialogDescription>
              {m.users_roles_edit_dialog_description({ name: user.name, email: user.email })}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{m.users_roles_edit_dialog_roles_label()}</legend>
          {EDITABLE_ROLE_OPTIONS.map((option) => {
            const inputId = `user-role-${option.value}`

            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted/40"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={selectedRoles.includes(option.value)}
                  disabled={pending}
                  onChange={() => toggleRole(option.value)}
                />
                <span className="text-sm">{option.label()}</span>
              </label>
            )
          })}
        </fieldset>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button
            type="button"
            disabled={pending || user === null || selectedRoles.length === 0}
            onClick={handleConfirm}
          >
            {m.users_roles_edit_dialog_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
