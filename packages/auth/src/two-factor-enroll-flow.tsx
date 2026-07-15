import { m } from '@mr/i18n'
import {
  Button,
  Card,
  CardContent,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  PasswordInput,
  REGEXP_ONLY_DIGITS,
} from '@mr/ui'
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { MRAuthClientWithTwoFactor } from './two-factor-types.js'
import { QRCodeSVG } from 'qrcode.react'

import {
  downloadBackupCodes,
  formatTwoFactorClientError,
  parseSecretFromTotpURI,
} from './two-factor-utils.js'

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
            <p className="text-sm text-muted-foreground">
              {m.security_two_factor_enroll_step_password_label()}
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="twof-enroll-pw" className="text-sm font-medium">
                {m.auth_login_password()}
              </label>
              <PasswordInput
                id="twof-enroll-pw"
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
              <Button
                type="button"
                disabled={pending || password.length === 0}
                onClick={() => void handleEnable()}
              >
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
              <p className="text-sm text-muted-foreground">
                {m.security_two_factor_enroll_step_qr_description()}
              </p>
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
              <span className="text-sm text-muted-foreground">
                {m.security_2fa_verify_description()}
              </span>
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
              <Button
                type="button"
                disabled={pending || totpDigits.length !== 6}
                onClick={() => void handleVerifyTotp()}
              >
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
              <p className="text-sm text-muted-foreground">
                {m.security_two_factor_enroll_step_backup_description()}
              </p>
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
