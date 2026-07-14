import { useState } from 'react'

import {
  LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE,
  loginAuthErrorKind,
  loginAuthErrorMessage,
} from '@mr/auth/route-guards'
import { m } from '@mr/i18n'
import { PORTAL_SUPPORT_EMAIL, formatFieldError } from '@mr/shared'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { LangThemeControls } from '~/components/lang-theme-controls'
import { MaskedIcon } from '~/components/masked-icon'
import { PortalButton } from '~/components/portal-button'
import { PortalFieldError, PortalInput, PortalLabel } from '~/components/portal-field'
import { HeroPanel } from '~/features/auth/hero-panel'
import { authClient } from '~/lib/auth-client'
import { hasSeenWelcome } from '~/lib/welcome-flag'

const loginSearchSchema = z.object({
  reason: z.literal(LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE).optional(),
  activated: z.boolean().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginComponent,
})

const loginRoute = getRouteApi('/login')

const loginSchema = z.object({
  email: z.email(m.field_email_invalid()),
  password: z.string().min(1, m.field_password_required()),
})

type SignInData = { twoFactorRedirect?: boolean } | null | undefined

function LoginComponent(): React.ReactElement {
  const navigate = useNavigate()
  const { reason, activated } = loginRoute.useSearch()
  const [authError, setAuthError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: {
      onChange: loginSchema,
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      setAuthError(null)
      setIsPending(true)

      try {
        const result = await authClient.signIn.email({
          email: value.email,
          password: value.password,
        })

        if (result.error) {
          // An unapproved account gets the dedicated pending screen (design),
          // not an inline error.
          if (loginAuthErrorKind(result.error.code, result.error.message) === 'pending') {
            await navigate({ to: '/pending' })
            return
          }
          setAuthError(
            loginAuthErrorMessage(
              result.error.code,
              {
                invalid: m.auth_login_error_invalid(),
                rateLimited: m.auth_login_error_rate_limited(),
                pending: m.auth_login_error_pending(),
                rejected: m.auth_login_error_rejected(),
                generic: m.auth_login_error_generic(),
              },
              result.error.message,
            ),
          )
          return
        }

        const data = result.data as SignInData
        if (data?.twoFactorRedirect === true) {
          setAuthError(m.auth_login_2fa_required())
          return
        }

        // First entry gets the welcome; returning clients go straight to claims.
        await navigate({ to: hasSeenWelcome() ? '/claims' : '/welcome' })
      } catch (err) {
        console.error('[login] unexpected error:', err)
        setAuthError(m.auth_login_error_generic())
      } finally {
        setIsPending(false)
      }
    },
  })

  return (
    <main className="flex min-h-screen bg-mrp-bg">
      <HeroPanel variant="login" />

      <div className="relative grid min-h-screen flex-1 place-items-center overflow-hidden bg-mrp-bg px-6 py-12 lg:min-w-[460px] lg:px-10">
        <div className="mrp-grid-bg absolute inset-0" />
        <div className="absolute -right-40 -top-[220px] size-[520px] rounded-full bg-[radial-gradient(circle,rgba(237,28,36,0.13),transparent_65%)]" />
        <div className="absolute right-8 top-7 z-[3]">
          <LangThemeControls />
        </div>

        <div
          className="mrp-fade-up relative z-[2] w-full max-w-[384px]"
          style={{ animationDelay: '0.15s' }}
        >
          <div className="mb-2.5 flex items-center gap-[11px]">
            <MaskedIcon name="cog" className="size-[22px] text-mrp-red" />
            <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">
              {m.portal_login_title()}
            </h1>
          </div>
          <p className="mb-8 text-[15px] text-mrp-text2">{m.portal_login_subtitle()}</p>

          {activated === true ? (
            <div
              role="status"
              className="mb-5 rounded-[10px] border border-[rgba(31,169,113,0.32)] bg-mrp-ok-bg p-3 text-sm"
            >
              {m.portal_login_activated()}
            </div>
          ) : null}
          {reason === LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE ? (
            <div
              role="alert"
              className="mb-5 rounded-[10px] border border-mrp-border2 bg-mrp-raised p-3 text-sm"
            >
              {m.auth_login_insufficient_role()}
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            noValidate
          >
            <form.Field
              name="email"
              children={(field) => (
                <div className="mb-5">
                  <PortalLabel htmlFor="email">{m.portal_login_email_label()}</PortalLabel>
                  <PortalInput
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                    }}
                    onBlur={field.handleBlur}
                    disabled={isPending}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <PortalFieldError>
                      {formatFieldError(field.state.meta.errors[0])}
                    </PortalFieldError>
                  )}
                </div>
              )}
            />

            <form.Field
              name="password"
              children={(field) => (
                <div className="mb-7">
                  <PortalLabel htmlFor="password">{m.portal_login_password_label()}</PortalLabel>
                  <PortalInput
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                    }}
                    onBlur={field.handleBlur}
                    disabled={isPending}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <PortalFieldError>
                      {formatFieldError(field.state.meta.errors[0])}
                    </PortalFieldError>
                  )}
                </div>
              )}
            />

            {authError !== null && (
              <div
                role="alert"
                className="mb-5 rounded-[10px] border border-[rgba(217,45,32,0.36)] bg-mrp-bad-bg p-3 text-sm text-mrp-bad"
              >
                {authError}
              </div>
            )}

            <PortalButton type="submit" disabled={isPending}>
              {m.portal_login_title()}
              <span className="font-normal">→</span>
            </PortalButton>
          </form>

          <div className="my-[30px] mb-[18px] flex items-center gap-3.5">
            <span className="h-px flex-1 bg-mrp-border" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mrp-text2">
              {m.portal_login_new_partner()}
            </span>
            <span className="h-px flex-1 bg-mrp-border" />
          </div>

          <PortalButton
            type="button"
            variant="secondary"
            onClick={() => {
              void navigate({ to: '/register' })
            }}
          >
            {m.portal_login_request_access()}
          </PortalButton>

          <p className="mt-[34px] text-center font-mono text-[11px] tracking-[0.04em] text-mrp-text2">
            mrclaims.live · {PORTAL_SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    </main>
  )
}
