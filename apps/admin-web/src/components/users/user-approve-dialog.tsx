import {
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mr/ui'
import { useState, type ReactElement } from 'react'

const APPROVE_ROLE_OPTIONS = [
  { value: SYSTEM_ROLE_OPERATOR, label: () => m.users_role_operator() },
  { value: SYSTEM_ROLE_VIEWER, label: () => m.users_role_viewer() },
] as const satisfies ReadonlyArray<{
  value: ApproveRegistrationRoleCode
  label: () => string
}>

interface UserApproveDialogProps {
  user: UserListItem | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (user: UserListItem, roleCode: ApproveRegistrationRoleCode) => void
}

export function UserApproveDialog({
  user,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: UserApproveDialogProps): ReactElement {
  const [roleCode, setRoleCode] = useState<ApproveRegistrationRoleCode>(
    DEFAULT_APPROVE_REGISTRATION_ROLE,
  )

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setRoleCode(DEFAULT_APPROVE_REGISTRATION_ROLE)
    }
    onOpenChange(nextOpen)
  }

  const handleConfirm = (): void => {
    if (user === null) {
      return
    }

    onConfirm(user, roleCode)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{m.users_approve_dialog_title()}</DialogTitle>
          {user !== null ? (
            <DialogDescription>
              {m.users_approve_dialog_description({ name: user.name, email: user.email })}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-2">
          <p id="approve-role-label" className="text-sm font-medium">
            {m.users_approve_dialog_role_label()}
          </p>
          <Select
            value={roleCode}
            onValueChange={(value) => setRoleCode(value as ApproveRegistrationRoleCode)}
          >
            <SelectTrigger id="approve-role" aria-labelledby="approve-role-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVE_ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button type="button" disabled={pending || user === null} onClick={handleConfirm}>
            {m.users_approve_dialog_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
