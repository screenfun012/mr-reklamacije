import { formatFieldError } from '@mr/shared'
import { useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import {
  LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE,
  loginAuthErrorMessage,
  TwoFactorVerifyForm,
} from '@mr/auth/route-guards'
import { m } from '@mr/i18n'
import { PasswordInput } from '@mr/ui'

import { authClient } from '~/lib/auth-client'
import { admFieldClassName, admLabelClassName, admPrimaryButtonClassName } from '~/lib/adm-chrome'

const loginSearchSchema = z.object({
  reason: z.literal(LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE).optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginComponent,
})

const loginRoute = getRouteApi('/login')

// Zod 4 is Standard-Schema-compliant, so TanStack Form v1 consumes it directly
// without the legacy @tanstack/zod-form-adapter package (deprecated in v1).
const loginSchema = z.object({
  email: z.email(m.field_email_invalid()),
  password: z.string().min(1, m.field_password_required()),
})

// Better-Auth may return `twoFactorRedirect` + `twoFactorMethods` on sign-in when
// the account has 2FA enabled (see two-factor plugin). Typings may not surface
// these fields; we narrow manually at the sign-in boundary.
type SignInData =
  | {
      twoFactorRedirect?: boolean
      twoFactorMethods?: string[]
    }
  | null
  | undefined

function LoginComponent(): React.ReactElement {
  const navigate = useNavigate()
  const { reason } = loginRoute.useSearch()
  const [authError, setAuthError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [showTwoFactorStep, setShowTwoFactorStep] = useState(false)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: {
      onChange: loginSchema,
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      setAuthError(null)
      setIsPending(true)

      let retryAfterSec: string | null = null

      try {
        const result = await authClient.signIn.email(
          {
            email: value.email,
            password: value.password,
          },
          {
            onError: ({ response }) => {
              retryAfterSec = response.headers.get('X-Retry-After')
            },
          },
        )

        if (result.error) {
          const lockMinutes = Math.max(1, Math.ceil(Number(retryAfterSec ?? '900') / 60))
          setAuthError(
            loginAuthErrorMessage(
              result.error.code,
              {
                invalid: m.auth_login_error_invalid(),
                rateLimited: m.auth_login_error_rate_limited(),
                accountLocked: m.auth_login_error_account_locked({ minutes: lockMinutes }),
                pending: m.auth_login_error_pending(),
                rejected: m.auth_login_error_rejected(),
                generic: m.auth_login_error_generic(),
              },
              result.error.message,
              result.error.status,
            ),
          )
          return
        }

        const data = result.data as SignInData
        if (data?.twoFactorRedirect === true) {
          setShowTwoFactorStep(true)
          return
        }

        await navigate({ to: '/' })
      } catch (err) {
        console.error('[login] unexpected error:', err)
        setAuthError(m.auth_login_error_generic())
      } finally {
        setIsPending(false)
      }
    },
  })

  return (
    // The workshop photograph is gone: the prototype puts the panel's own graph paper behind this
    // card, and a sign-in for one administrator does not need a hero. internal-web and portal-web
    // keep theirs — they are the screens clients and the shop floor see.
    <main className="adm-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="adm-enter relative z-10 w-full max-w-[420px] rounded-2xl border border-border bg-card px-9 py-8 [animation-duration:.4s]">
        <div className="mb-4">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-adm-red-h">
            {m.admin_login_eyebrow()}
          </p>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-foreground">
            {m.auth_login_title()}
          </h1>
        </div>
        <div>
          {reason === LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE ? (
            <div
              role="alert"
              className="mb-4 rounded-[10px] border border-mr-border-strong bg-adm-inbg px-3.5 py-2.5 text-[13px] leading-[1.5] text-foreground"
            >
              {m.auth_login_insufficient_role()}
            </div>
          ) : null}
          {showTwoFactorStep ? (
            <div className="flex flex-col gap-4">
              <TwoFactorVerifyForm
                authClient={authClient}
                onSuccess={async () => navigate({ to: '/' })}
                onError={(message: string) => setAuthError(message)}
              />
              {authError !== null ? (
                <div
                  role="alert"
                  className="rounded-[10px] border border-mr-brand/35 bg-mr-brand/10 px-3.5 py-2.5 text-[13px] leading-[1.5] text-foreground"
                >
                  {authError}
                </div>
              ) : null}
            </div>
          ) : null}

          {!showTwoFactorStep ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
              className="flex flex-col gap-4"
              noValidate
            >
              <form.Field
                name="email"
                children={(field) => (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className={admLabelClassName}>
                      {m.auth_login_email()}
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className={`${admFieldClassName} h-[46px] text-[15px]`}
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                      }}
                      onBlur={field.handleBlur}
                      disabled={isPending}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <span className="text-[12.5px] text-adm-red-h">
                        {formatFieldError(field.state.meta.errors[0])}
                      </span>
                    )}
                  </div>
                )}
              />

              <form.Field
                name="password"
                children={(field) => (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className={admLabelClassName}>
                      {m.auth_login_password()}
                    </label>
                    {/* Still `@mr/ui`'s: it carries the show/hide eye, which is a behaviour and not
                        a skin. Only its height is pulled up to the field beside it. */}
                    <PasswordInput
                      id="password"
                      autoComplete="current-password"
                      className="h-[46px] rounded-[9px] border-mr-border-strong bg-adm-inbg text-[15px]"
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                      }}
                      onBlur={field.handleBlur}
                      disabled={isPending}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <span className="text-[12.5px] text-adm-red-h">
                        {formatFieldError(field.state.meta.errors[0])}
                      </span>
                    )}
                  </div>
                )}
              />

              {authError !== null && (
                <div
                  role="alert"
                  className="rounded-[10px] border border-mr-brand/35 bg-mr-brand/10 px-3.5 py-2.5 text-[13px] leading-[1.5] text-foreground"
                >
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className={`${admPrimaryButtonClassName} h-12 w-full flex-none shadow-[0_8px_22px_rgba(0,0,0,.3)]`}
              >
                {m.auth_login_submit()}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  )
}

// Standard-Schema errors arrive as objects with a `message` field; plain-string
// errors are passed through verbatim. Defensive against undefined because
// `errors[0]` is typed as `unknown`.
