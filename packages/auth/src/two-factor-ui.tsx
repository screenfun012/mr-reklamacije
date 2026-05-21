import { m } from '@mr/i18n'
import {
  Button,
  Card,
  CardContent,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
  cn,
} from '@mr/ui'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { MRAuthClientForPermissions } from './route-guards.js'

/** Better-Auth two-factor mutation response shape (narrow subset for UI). */
export type TwoFactorMutationResult = {
  data?: {
    status?: boolean
    totpURI?: string
    backupCodes?: string[]
    token?: string
    user?: unknown
    [key: string]: unknown
  } | null
  error?: {
    code?: string
    message?: string
    /** HTTP status when Better Fetch surfaces it (e.g. 401 = missing/invalid 2FA pending cookie). */
    status?: number
  } | null
}

export type MRAuthClientTwoFactorApi = {
  enable: (input: { password: string }) => Promise<TwoFactorMutationResult>
  verifyTotp: (input: { code: string; trustDevice?: boolean }) => Promise<TwoFactorMutationResult>
  verifyBackupCode: (input: { code: string; trustDevice?: boolean }) => Promise<TwoFactorMutationResult>
  disable: (input: { password: string }) => Promise<TwoFactorMutationResult>
}

/**
 * Auth client with Better-Auth two-factor plugin methods (see `twoFactorClient()`
 * in `@mr/auth/client` presets). Runtime includes `twoFactor` when the plugin is
 * enabled; generated client typings may omit it, so the property is optional here.
 */
export type MRAuthClientWithTwoFactor = MRAuthClientForPermissions & {
  twoFactor?: MRAuthClientTwoFactorApi
  getSession?: () => Promise<unknown>
}

export function useTwoFactor(authClient: MRAuthClientForPermissions): {
  isEnabled: boolean
  isLoading: boolean
} {
  const { data: session, isPending } = authClient.useSession()
  return {
    isEnabled: Boolean(
      session?.user && 'twoFactorEnabled' in session.user && session.user['twoFactorEnabled'] === true,
    ),
    isLoading: isPending,
  }
}

/** Extract TOTP shared secret from an `otpauth://` provisioning URI (manual entry). */
export function parseSecretFromTotpURI(uri: string): string {
  try {
    const u = new URL(uri)
    return u.searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

/** Download backup codes as a plain-text file in the browser. */
export function downloadBackupCodes(codes: readonly string[], filename: string): void {
  if (typeof document === 'undefined') {
    return
  }
  const text = codes.join('\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function formatTwoFactorClientError(err: { code?: string } | undefined | null): string {
  const code = err?.code
  if (code === 'INVALID_CODE' || code === 'TOTP_NOT_ENABLED') {
    return m.auth_login_2fa_invalid_code()
  }
  if (code === 'INVALID_BACKUP_CODE' || code === 'BACKUP_CODES_NOT_ENABLED') {
    return m.auth_login_2fa_invalid_backup()
  }
  return m.auth_login_2fa_invalid_code()
}

function isTwoFactorSessionExpiredError(err: { code?: string; status?: number } | undefined | null): boolean {
  if (!err) return false
  if (err.status === 401) return true
  return err.code === 'INVALID_TWO_FACTOR_COOKIE'
}

function messageForTotpVerifyFailure(err: { code?: string; status?: number } | undefined | null): string {
  if (isTwoFactorSessionExpiredError(err)) {
    return m.auth_login_2fa_session_expired()
  }
  return formatTwoFactorClientError(err)
}

function messageForBackupVerifyFailure(err: { code?: string; status?: number } | undefined | null): string {
  if (isTwoFactorSessionExpiredError(err)) {
    return m.auth_login_2fa_session_expired()
  }
  const code = err?.code
  if (code === 'INVALID_BACKUP_CODE' || code === 'BACKUP_CODES_NOT_ENABLED') {
    return m.auth_login_2fa_invalid_backup()
  }
  return m.auth_login_2fa_invalid_backup()
}

type EnrollStep = 'password' | 'qr-verify' | 'backup-codes'

export function TwoFactorEnrollFlow(props: {
  authClient: MRAuthClientWithTwoFactor
  onComplete?: () => void
  onCancel?: () => void
}): ReactNode {
  const { authClient, onComplete, onCancel } = props
  const [step, setStep] = useState<EnrollStep>('password')
  const [password, setPassword] = useState('')
  const [totpURI, setTotpURI] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [totpDigits, setTotpDigits] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const tf = authClient.twoFactor
  if (!tf) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{m.security_two_factor_unavailable()}</p>
        </CardContent>
      </Card>
    )
  }

  const handleEnable = async (): Promise<void> => {
    setError(null)
    setPending(true)
    try {
      const res = await tf.enable({ password })
      if (res.error) {
        setError(m.auth_login_error_invalid())
        setPending(false)
        return
      }
      const data = res.data as { totpURI?: string; backupCodes?: string[] } | undefined
      if (data?.totpURI && Array.isArray(data.backupCodes)) {
        setTotpURI(data.totpURI)
        setBackupCodes([...data.backupCodes])
        setStep('qr-verify')
      } else {
        setError(m.auth_login_error_generic())
      }
    } finally {
      setPending(false)
    }
  }

  const handleVerifyTotp = async (): Promise<void> => {
    setError(null)
    if (totpDigits.length !== 6) {
      setError(m.auth_login_2fa_invalid_code())
      return
    }
    setPending(true)
    try {
      const res = await tf.verifyTotp({ code: totpDigits })
      if (res.error) {
        setError(formatTwoFactorClientError(res.error))
        return
      }
      setStep('backup-codes')
    } finally {
      setPending(false)
    }
  }

  const handleFinish = (): void => {
    void authClient.getSession?.()
    onComplete?.()
  }

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="flex flex-col gap-4 pt-6">
        {step === 'password' ? (
          <>
            <p className="text-sm text-muted-foreground">{m.security_two_factor_enroll_step_password_label()}</p>
            <div className="flex flex-col gap-1">
              <label htmlFor="twof-enroll-pw" className="text-sm font-medium">
                {m.auth_login_password()}
              </label>
              <Input
                id="twof-enroll-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                }}
                disabled={pending}
              />
            </div>
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || password.length === 0} onClick={() => void handleEnable()}>
                {pending ? m.common_loading() : m.common_confirm()}
              </Button>
              {onCancel ? (
                <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                  {m.action_cancel()}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 'qr-verify' ? (
          <>
            <div>
              <p className="text-sm font-medium">{m.security_two_factor_enroll_step_qr_title()}</p>
              <p className="text-sm text-muted-foreground">{m.security_two_factor_enroll_step_qr_description()}</p>
            </div>
            <div className="flex justify-center rounded-md border bg-background p-4">
              <QRCodeSVG value={totpURI} size={192} level="M" />
            </div>
            <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs break-all">
              <span className="font-sans text-sm font-medium text-foreground">
                {m.security_two_factor_enroll_step_qr_manual_entry()}{' '}
              </span>
              {parseSecretFromTotpURI(totpURI)}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{m.security_2fa_verify_title()}</span>
              <span className="text-sm text-muted-foreground">{m.security_2fa_verify_description()}</span>
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
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || totpDigits.length !== 6} onClick={() => void handleVerifyTotp()}>
                {pending ? m.common_loading() : m.security_two_factor_enroll_step_verify_button()}
              </Button>
              {onCancel ? (
                <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                  {m.action_cancel()}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 'backup-codes' ? (
          <>
            <div>
              <p className="text-sm font-medium">{m.security_2fa_backup_title()}</p>
              <p className="text-sm text-muted-foreground">{m.security_2fa_backup_description()}</p>
            </div>
            <ul className="grid grid-cols-2 gap-2 rounded-md border p-3 font-mono text-sm">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void navigator.clipboard.writeText(backupCodes.join('\n'))}
              >
                {m.security_two_factor_enroll_copy_button()}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => downloadBackupCodes(backupCodes, 'mre-2fa-backup-codes.txt')}
              >
                {m.security_two_factor_enroll_download_button()}
              </Button>
            </div>
            <Button type="button" onClick={handleFinish}>
              {m.security_two_factor_enroll_saved_button()}
            </Button>
          </>
        ) : null}

      </CardContent>
    </Card>
  )
}

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

type DisableStep = 'password' | 'totp' | 'confirm' | 'complete'

export function TwoFactorDisableFlow(props: {
  authClient: MRAuthClientWithTwoFactor
  onComplete?: () => void
  onCancel?: () => void
}): ReactNode {
  const { authClient, onComplete, onCancel } = props
  const [step, setStep] = useState<DisableStep>('password')
  const [password, setPassword] = useState('')
  const [totpDigits, setTotpDigits] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const tf = authClient.twoFactor
  if (!tf) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{m.security_two_factor_unavailable()}</p>
        </CardContent>
      </Card>
    )
  }

  const handlePasswordContinue = (): void => {
    setError(null)
    if (password.length === 0) {
      setError(m.field_password_required())
      return
    }
    setStep('totp')
  }

  const handleTotpContinue = async (): Promise<void> => {
    setError(null)
    if (totpDigits.length !== 6) {
      setError(m.auth_login_2fa_invalid_code())
      return
    }
    setPending(true)
    try {
      const res = await tf.verifyTotp({ code: totpDigits })
      if (res.error) {
        setError(formatTwoFactorClientError(res.error))
        return
      }
      setStep('confirm')
    } finally {
      setPending(false)
    }
  }

  const handleDisable = async (): Promise<void> => {
    setError(null)
    setPending(true)
    try {
      const res = await tf.disable({ password })
      if (res.error) {
        setError(m.auth_login_error_generic())
        return
      }
      setPassword('')
      setTotpDigits('')
      setStep('complete')
      void authClient.getSession?.()
      onComplete?.()
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="flex flex-col gap-4 pt-6">
        {step === 'password' ? (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="twof-disable-pw" className="text-sm font-medium">
                {m.auth_login_password()}
              </label>
              <Input
                id="twof-disable-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                }}
                disabled={pending}
              />
            </div>
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || password.length === 0} onClick={handlePasswordContinue}>
                {pending ? m.common_loading() : m.common_confirm()}
              </Button>
              {onCancel ? (
                <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                  {m.action_cancel()}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 'totp' ? (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{m.auth_login_2fa_code_label()}</span>
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
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending || totpDigits.length !== 6} onClick={() => void handleTotpContinue()}>
                {pending ? m.common_loading() : m.common_confirm()}
              </Button>
              {onCancel ? (
                <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                  {m.action_cancel()}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <p className="text-sm">{m.security_two_factor_disable_warning()}</p>
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="destructive" disabled={pending} onClick={() => void handleDisable()}>
                {pending ? m.common_loading() : m.security_two_factor_disable_confirm_button()}
              </Button>
              {onCancel ? (
                <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                  {m.action_cancel()}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 'complete' ? <p className="text-sm text-muted-foreground">{m.security_two_factor_status_disabled()}</p> : null}
      </CardContent>
    </Card>
  )
}
