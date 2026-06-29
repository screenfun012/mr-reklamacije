import { useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PASSWORD_MIN_LENGTH } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Card, CardContent, CardHeader, Heading, Input } from '@mr/ui'

import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
})

const registerSchema = z.object({
  firstName: z.string().min(1, m.field_first_name_required()),
  lastName: z.string().min(1, m.field_last_name_required()),
  email: z.email(m.field_email_invalid()),
  password: z.string().min(PASSWORD_MIN_LENGTH, m.field_password_min_length()),
})

function RegisterComponent(): React.ReactElement {
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
    validators: {
      onChange: registerSchema,
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null)
      setIsPending(true)

      try {
        const name = `${value.firstName.trim()} ${value.lastName.trim()}`.trim()
        const result = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name,
        })

        if (result.error) {
          const code = result.error.code
          if (code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
            setFormError(m.auth_register_error_email_taken())
          } else {
            setFormError(m.auth_register_error_generic())
          }
          return
        }

        setIsSuccess(true)
      } catch (err) {
        console.error('[register] unexpected error:', err)
        setFormError(m.auth_register_error_generic())
      } finally {
        setIsPending(false)
      }
    },
  })

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/background.png')] bg-cover bg-center bg-no-repeat"
      />
      <Card className="relative z-10 w-full max-w-md border border-white/15 bg-card/75 shadow-xl backdrop-blur-md">
        <CardHeader>
          <Heading level="h2" as="h1">
            {m.auth_register_title()}
          </Heading>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="flex flex-col gap-4">
              <div
                role="status"
                className="rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground"
              >
                {m.auth_register_success_pending()}
              </div>
              <Link
                to="/login"
                className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {m.auth_register_back_to_login()}
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
              className="flex flex-col gap-4"
              noValidate
            >
              <form.Field
                name="firstName"
                children={(field) => (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="firstName" className="text-sm font-medium">
                      {m.auth_register_first_name()}
                    </label>
                    <Input
                      id="firstName"
                      autoComplete="given-name"
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
                name="lastName"
                children={(field) => (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="lastName" className="text-sm font-medium">
                      {m.auth_register_last_name()}
                    </label>
                    <Input
                      id="lastName"
                      autoComplete="family-name"
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
                      autoComplete="new-password"
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

              {formError !== null && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <Button type="submit" loading={isPending} className="w-full">
                {m.auth_register_submit()}
              </Button>

              <Link
                to="/login"
                className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {m.auth_register_back_to_login()}
              </Link>
            </form>
          )}
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
