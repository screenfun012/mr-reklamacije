import { formatFieldError } from '@mr/shared'
import { useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { createFileRoute, getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import {
  LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE,
  loginAuthErrorMessage,
  TwoFactorVerifyForm,
} from '@mr/auth/route-guards'
import { m } from '@mr/i18n'

import { AuthHeroPanel } from '~/components/auth/auth-hero-panel'
import { AuthTextField } from '~/components/auth/auth-text-field'
import { InternalButton, internalButtonClasses } from '~/components/internal-button'
import { InternalNote } from '~/components/internal-note'
import { LocaleThemeControls } from '~/components/layout/locale-theme-controls'
import { InternalLogo, MaskedIcon } from '~/components/masked-icon'
import { authClient } from '~/lib/auth-client'

const loginSearchSchema = z.object({
  reason: z.literal(LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE).optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginComponent,
})

const loginRoute = getRouteApi('/login')

// Zod 4 is Standard-Schema-compliant, so TanStack Form v1 consumes it directly
const loginSchema = z.object({
  email: z.email(m.field_email_invalid()),
  password: z.string().min(1, m.field_password_required()),
})

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
    <main className="flex min-h-screen bg-mri-bg font-sans text-mri-text">
      <AuthHeroPanel variant="login" />

      <div className="relative grid min-w-0 flex-1 place-items-center overflow-hidden px-10 py-12 lg:min-w-[460px]">
        <div aria-hidden="true" className="mri-grid-bg absolute inset-0" />
        <div
          aria-hidden="true"
          className="absolute -right-40 -top-[220px] size-[520px] rounded-full bg-[radial-gradient(circle,rgba(237,28,36,0.13),transparent_65%)]"
        />
        <div className="absolute right-8 top-7 z-[3]">
          <LocaleThemeControls />
        </div>

        <div
          className="mri-fade-up relative z-[2] w-full max-w-[384px]"
          style={{ animationDelay: '0.15s' }}
        >
          <InternalLogo className="mb-9 h-8 w-[124px] lg:hidden" />

          <div className="mb-2.5 flex items-center gap-[11px]">
            <MaskedIcon name="cog" className="size-[22px] text-mri-red" />
            <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">
              {m.auth_login_title()}
            </h1>
          </div>
          <p className="mb-8 text-[15px] text-mri-text2">{m.internal_login_subtitle()}</p>

          {reason === LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE ? (
            <InternalNote tone="warn" role="alert" className="mb-5">
              {m.auth_login_insufficient_role()}
            </InternalNote>
          ) : null}

          {showTwoFactorStep ? (
            <div className="flex flex-col gap-4">
              <TwoFactorVerifyForm
                authClient={authClient}
                onSuccess={async () => navigate({ to: '/' })}
                onError={(message: string) => setAuthError(message)}
              />
              {authError !== null ? (
                <InternalNote tone="error" role="alert">
                  {authError}
                </InternalNote>
              ) : null}
            </div>
          ) : null}

          {!showTwoFactorStep ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
              className="flex flex-col"
              noValidate
            >
              <form.Field
                name="email"
                children={(field) => (
                  <AuthTextField
                    id="email"
                    type="email"
                    label={m.auth_login_email()}
                    autoComplete="email"
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    disabled={isPending}
                    error={
                      field.state.meta.errors.length > 0
                        ? formatFieldError(field.state.meta.errors[0])
                        : null
                    }
                    className="mb-5"
                  />
                )}
              />

              <form.Field
                name="password"
                children={(field) => (
                  <AuthTextField
                    id="password"
                    type="password"
                    label={m.auth_login_password()}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    disabled={isPending}
                    error={
                      field.state.meta.errors.length > 0
                        ? formatFieldError(field.state.meta.errors[0])
                        : null
                    }
                    className="mb-7"
                  />
                )}
              />

              {authError !== null ? (
                <InternalNote tone="error" role="alert" className="mb-5">
                  {authError}
                </InternalNote>
              ) : null}

              <InternalButton type="submit" disabled={isPending}>
                {m.auth_login_submit()} <span className="font-normal">→</span>
              </InternalButton>

              <div className="my-[26px] flex items-center gap-3.5">
                <span aria-hidden="true" className="h-px flex-1 bg-mri-border" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mri-text2">
                  {m.internal_login_new_employee()}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-mri-border" />
              </div>

              <Link to="/register" className={internalButtonClasses('outline')}>
                {m.auth_login_register_link()}
              </Link>

              <p className="mt-8 text-center font-mono text-[11px] tracking-[0.04em] text-mri-text2">
                mrclaims.live · {m.internal_login_staff_only()}
              </p>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  )
}
