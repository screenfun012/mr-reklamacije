import { m } from '@mr/i18n'
import {
  Button,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
  cn,
} from '@mr/ui'
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { MRAuthClientWithTwoFactor } from './two-factor-types.js'

import { messageForBackupVerifyFailure, messageForTotpVerifyFailure } from './two-factor-utils.js'

type VerifyMode = 'totp' | 'backup'

export function TwoFactorVerifyForm(props: {
  authClient: MRAuthClientWithTwoFactor
  onSuccess?: () => void
  onError?: (message: string) => void
  allowBackupCode?: boolean
}): ReactNode {
  const { authClient, onSuccess, onError, allowBackupCode = true } = props
  const [mode, setMode] = useState<VerifyMode>('totp')
  const [totpDigits, setTotpDigits] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [pending, setPending] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)
  const [totpInvalidFlash, setTotpInvalidFlash] = useState(false)
  const [backupInvalidFlash, setBackupInvalidFlash] = useState(false)

  const tf = authClient.twoFactor
  if (!tf) {
    return (
      <div className="text-sm text-destructive" role="alert">
        {m.security_two_factor_unavailable()}
      </div>
    )
  }

  const flashTotpError = (): void => {
    setTotpInvalidFlash(true)
    window.setTimeout(() => {
      setTotpInvalidFlash(false)
    }, 450)
  }

  const flashBackupError = (): void => {
    setBackupInvalidFlash(true)
    window.setTimeout(() => {
      setBackupInvalidFlash(false)
    }, 450)
  }

  const submitTotp = async (): Promise<void> => {
    if (totpDigits.length !== 6) {
      onError?.(m.auth_login_2fa_invalid_code())
      return
    }
    setPending(true)
    try {
      const res = await tf.verifyTotp({ code: totpDigits, trustDevice })
      if (res.error) {
        onError?.(messageForTotpVerifyFailure(res.error))
        setTotpDigits('')
        flashTotpError()
        return
      }
      await authClient.getSession?.()
      onSuccess?.()
    } catch {
      onError?.(m.auth_login_2fa_network_error())
      setTotpDigits('')
      flashTotpError()
    } finally {
      setPending(false)
    }
  }

  const submitBackup = async (): Promise<void> => {
    const trimmed = backupCode.trim()
    if (trimmed.length < 8) {
      onError?.(m.auth_login_2fa_invalid_backup())
      return
    }
    setPending(true)
    try {
      const res = await tf.verifyBackupCode({ code: trimmed, trustDevice })
      if (res.error) {
        onError?.(messageForBackupVerifyFailure(res.error))
        setBackupCode('')
        flashBackupError()
        return
      }
      await authClient.getSession?.()
      onSuccess?.()
    } catch {
      onError?.(m.auth_login_2fa_network_error())
      setBackupCode('')
      flashBackupError()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{m.auth_login_2fa_title()}</p>
        <p className="text-sm text-muted-foreground">{m.auth_login_2fa_description()}</p>
      </div>

      {mode === 'totp' ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{m.auth_login_2fa_code_label()}</span>
            <div
              className={cn(
                'rounded-md p-1 transition-[box-shadow]',
                totpInvalidFlash && 'ring-2 ring-destructive ring-offset-2 ring-offset-background',
              )}
            >
              <InputOTP
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpDigits}
                onChange={setTotpDigits}
                disabled={pending}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              checked={trustDevice}
              type="checkbox"
              disabled={pending}
              onChange={(e) => {
                setTrustDevice(e.target.checked)
              }}
              className="h-4 w-4 rounded border border-input accent-primary"
            />
            <span>{m.auth_login_2fa_trust_device()}</span>
          </label>
          <Button
            type="button"
            className="w-full"
            disabled={pending || totpDigits.length !== 6}
            onClick={() => void submitTotp()}
          >
            {pending ? m.common_loading() : m.auth_login_2fa_verify_button()}
          </Button>
          {allowBackupCode ? (
            <button
              type="button"
              className="text-sm text-primary underline-offset-4 hover:underline"
              disabled={pending}
              onClick={() => {
                setMode('backup')
              }}
            >
              {m.auth_login_2fa_use_backup_link()}
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div
            className={cn(
              'flex flex-col gap-1 rounded-md',
              backupInvalidFlash && 'ring-2 ring-destructive ring-offset-2 ring-offset-background',
            )}
          >
            <label htmlFor="twof-backup" className="text-sm font-medium">
              {m.auth_login_2fa_backup_code_label()}
            </label>
            <Input
              id="twof-backup"
              autoComplete="off"
              spellCheck={false}
              value={backupCode}
              onChange={(e) => {
                setBackupCode(e.target.value)
              }}
              disabled={pending}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              checked={trustDevice}
              type="checkbox"
              disabled={pending}
              onChange={(e) => {
                setTrustDevice(e.target.checked)
              }}
              className="h-4 w-4 rounded border border-input accent-primary"
            />
            <span>{m.auth_login_2fa_trust_device()}</span>
          </label>
          <Button
            type="button"
            className="w-full"
            disabled={pending || backupCode.trim().length < 8}
            onClick={() => void submitBackup()}
          >
            {pending ? m.common_loading() : m.auth_login_2fa_verify_button()}
          </Button>
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            disabled={pending}
            onClick={() => {
              setMode('totp')
            }}
          >
            {m.auth_login_2fa_back_to_totp()}
          </button>
        </>
      )}
    </div>
  )
}
