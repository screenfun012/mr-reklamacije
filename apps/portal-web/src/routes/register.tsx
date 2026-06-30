import { useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { registerClient } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Card, CardContent, CardHeader, Heading, Input } from '@mr/ui'

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
})

const registerSchema = z.object({
  name: z.string().min(1, m.portal_register_name_required()),
  email: z.email(m.field_email_invalid()),
  companyName: z.string().min(1, m.portal_register_company_required()),
})

function RegisterComponent(): React.ReactElement {
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const form = useForm({
    defaultValues: { name: '', email: '', companyName: '' },
    validators: {
      onChange: registerSchema,
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      setIsPending(true)

      try {
        await registerClient({
          name: value.name.trim(),
          email: value.email.trim(),
          companyName: value.companyName.trim(),
        })
        setIsSuccess(true)
      } catch (err) {
        console.error('[register] unexpected error:', err)
        setError(m.auth_register_error_generic())
      } finally {
        setIsPending(false)
      }
    },
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Heading level="h2" as="h1">
            {m.auth_register_title()}
          </Heading>
          <p className="text-sm text-muted-foreground">{m.portal_register_subtitle()}</p>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="flex flex-col gap-4">
              <div
                role="status"
                className="rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground"
              >
                {m.portal_register_success_pending()}
              </div>
              <Link to="/login" className="text-sm font-medium text-mr-info-strong hover:underline">
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
                name="name"
                children={(field) => (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="name" className="text-sm font-medium">
                      {m.portal_register_name_label()}
                    </label>
                    <Input
                      id="name"
                      type="text"
                      autoComplete="name"
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
                name="companyName"
                children={(field) => (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="companyName" className="text-sm font-medium">
                      {m.portal_register_company_label()}
                    </label>
                    <Input
                      id="companyName"
                      type="text"
                      autoComplete="organization"
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

              {error !== null && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" loading={isPending} className="w-full">
                {m.auth_register_submit()}
              </Button>

              <Link
                to="/login"
                className="text-center text-sm text-muted-foreground hover:underline"
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
