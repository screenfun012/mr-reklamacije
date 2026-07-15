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

import { formatTwoFactorClientError } from './two-factor-utils.js'

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
              <PasswordInput
                id="twof-disable-pw"
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
                onClick={handlePasswordContinue}
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
              <Button
                type="button"
                disabled={pending || totpDigits.length !== 6}
                onClick={() => void handleTotpContinue()}
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

        {step === 'confirm' ? (
          <>
            <p className="text-sm">{m.security_two_factor_disable_warning()}</p>
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => void handleDisable()}
              >
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

        {step === 'complete' ? (
          <p className="text-sm text-muted-foreground">{m.security_two_factor_status_disabled()}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
