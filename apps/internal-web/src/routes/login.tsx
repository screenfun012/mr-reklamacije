import { useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE } from '@mr/auth/route-guards'
import { m } from '@mr/i18n'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@mr/ui'

import { authClient } from '~/lib/auth-client'

const loginSearchSchema = z.object({
  reason: z.literal(LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE).optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginComponent,
})

// Zod 4 is Standard-Schema-compliant, so TanStack Form v1 consumes it directly
const loginSchema = z.object({
  email: z.email(m.field_email_invalid()),
  password: z.string().min(1, m.field_password_required()),
})

type SignInData = { twoFactorRedirect?: boolean } | null | undefined

function LoginComponent(): React.ReactElement {
  const navigate = useNavigate()
  const { reason } = Route.useSearch()
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
          if (result.error.code === 'INVALID_EMAIL_OR_PASSWORD') {
            setAuthError(m.auth_login_error_invalid())
          } else {
            setAuthError(m.auth_login_error_generic())
          }
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
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{m.auth_login_title_internal()}</CardTitle>
        </CardHeader>
        <CardContent>
          {reason === LOGIN_REDIRECT_REASON_INSUFFICIENT_ROLE ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground"
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
                <div className="flex flex-col gap-1">
                  <label htmlFor="email" className="text-sm font-medium">
                    {m.auth_login_email()}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
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
                <div className="flex flex-col gap-1">
                  <label htmlFor="password" className="text-sm font-medium">
                    {m.auth_login_password()}
                  </label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
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
              <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
                {authError}
              </div>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {m.auth_login_submit()}
            </Button>
          </form>
        </CardContent>
      </Card>
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
