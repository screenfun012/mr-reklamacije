import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type UserListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@mr/ui'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState, type ReactElement } from 'react'

import { admDialogClassName } from '~/lib/adm-chrome'

interface UserPasswordResetDialogProps {
  user: UserListItem | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (user: UserListItem, newPassword: string) => void
}

export function UserPasswordResetDialog({
  user,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: UserPasswordResetDialogProps): ReactElement {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setConfirmPassword('')
      setRevealed(false)
    }
  }, [open])

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password
  const isValid =
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    confirmPassword === password

  const handleConfirm = (): void => {
    if (user === null || !isValid) {
      return
    }

    onConfirm(user, password)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${admDialogClassName} max-w-md`}>
        <DialogHeader>
          <DialogTitle>{m.users_reset_password_dialog_title()}</DialogTitle>
          {user !== null ? (
            <DialogDescription>
              {m.users_reset_password_dialog_description({ name: user.name, email: user.email })}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="reset-password-new" className="text-sm font-medium">
              {m.users_reset_password_new_label()}
            </label>
            <div className="relative">
              <Input
                id="reset-password-new"
                type={revealed ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-10"
                value={password}
                disabled={pending}
                maxLength={PASSWORD_MAX_LENGTH}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                aria-label={
                  revealed ? m.users_reset_password_hide() : m.users_reset_password_show()
                }
                onClick={() => setRevealed((current) => !current)}
              >
                {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{m.users_reset_password_min_hint()}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="reset-password-confirm" className="text-sm font-medium">
              {m.users_reset_password_confirm_label()}
            </label>
            <Input
              id="reset-password-confirm"
              type={revealed ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              disabled={pending}
              maxLength={PASSWORD_MAX_LENGTH}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {tooShort ? (
              <p className="text-xs text-mr-error-strong">{m.users_reset_password_min_hint()}</p>
            ) : null}
            {mismatch ? (
              <p className="text-xs text-mr-error-strong">{m.users_reset_password_mismatch()}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button
            type="button"
            disabled={pending || user === null || !isValid}
            onClick={handleConfirm}
          >
            {m.users_reset_password_submit()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
