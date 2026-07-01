import { useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { createFileRoute, getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import {
  LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE,
  loginAuthErrorMessage,
} from '@mr/auth/route-guards'
import { m } from '@mr/i18n'
import { Button, Input } from '@mr/ui'
import { Lock } from 'lucide-react'

import { LanguageSwitcher } from '~/components/layout/language-switcher'
import { LoginHero } from '~/features/auth/login-hero'
import { authClient } from '~/lib/auth-client'

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
    <main className="relative flex min-h-screen flex-col bg-mr-bg-base lg:flex-row">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 lg:px-10">
        <Link to="/login" className="flex items-center gap-2">
          <img src="/mr-crest.png" alt="MR Engines" className="h-9 w-auto lg:h-11" />
        </Link>
        <LanguageSwitcher />
      </div>

      <LoginHero />

      <div className="flex flex-1 items-center justify-center bg-mr-surface-form px-6 py-24 lg:border-l lg:border-border">
        <div className="animate-mr-fade-up w-full max-w-[392px]">
          <div className="mb-8 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <span className="mr-shear inline-block h-2.5 w-2.5 bg-primary" aria-hidden="true">
                <span className="mr-shear-content sr-only">•</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mr-text-tertiary">
                {m.portal_login_brand_tag()}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {m.portal_login_form_title()}
            </h1>
            <p className="text-sm text-muted-foreground">{m.portal_login_form_subtitle()}</p>
          </div>

          {activated === true ? (
            <div
              role="status"
              className="mb-4 rounded-md border border-mr-status-accepted-border bg-mr-status-accepted-bg p-3 text-sm text-foreground"
            >
              {m.portal_login_activated()}
            </div>
          ) : null}
          {reason === LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-border bg-mr-surface-raised p-3 text-sm text-foreground"
            >
              {m.auth_login_insufficient_role()}
            </div>
          ) : null}

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
                  <label htmlFor="email" className="text-sm font-medium text-mr-text-body">
                    {m.auth_login_email()}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="h-[46px] bg-white/[0.04]"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                    }}
                    onBlur={field.handleBlur}
                    disabled={isPending}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <span className="text-sm text-destructive">
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
                  <label htmlFor="password" className="text-sm font-medium text-mr-text-body">
                    {m.auth_login_password()}
                  </label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="h-[46px] bg-white/[0.04]"
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value)
                    }}
                    onBlur={field.handleBlur}
                    disabled={isPending}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <span className="text-sm text-destructive">
                      {formatFieldError(field.state.meta.errors[0])}
                    </span>
                  )}
                </div>
              )}
            />

            {authError !== null && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {authError}
              </div>
            )}

            <Button type="submit" loading={isPending} className="h-12 w-full">
              {m.auth_login_submit()}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {m.portal_login_no_account()}{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                {m.auth_login_register_link()}
              </Link>
            </p>
          </form>

          <p className="mt-8 flex items-center justify-center gap-2 font-mono text-xs text-mr-text-tertiary">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {m.portal_login_secure()}
          </p>
        </div>
      </div>
    </main>
  )
}

function formatFieldError(err: unknown): string {
  if (err === null || err === undefined) return ''
  if (typeof err === 'string') return err
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return String(err)
}
