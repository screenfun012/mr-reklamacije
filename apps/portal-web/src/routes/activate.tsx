import { useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { createFileRoute, getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { ApiError, PASSWORD_MIN_LENGTH, completeActivation } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Card, CardContent, CardHeader, Heading, Input } from '@mr/ui'

const activateSearchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/activate')({
  validateSearch: (search) => activateSearchSchema.parse(search),
  component: ActivateComponent,
})

const activateRoute = getRouteApi('/activate')

const activateSchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH, m.portal_activate_password_min()),
})

function ActivateComponent(): React.ReactElement {
  const navigate = useNavigate()
  const { token } = activateRoute.useSearch()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useForm({
    defaultValues: { password: '' },
    validators: {
      onChange: activateSchema,
      onSubmit: activateSchema,
    },
    onSubmit: async ({ value }) => {
      if (token === undefined || token === '') {
        return
      }

      setError(null)
      setIsPending(true)

      try {
        await completeActivation({ token, newPassword: value.password })
        await navigate({ to: '/login', search: { activated: true } })
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
          setError(m.portal_activate_error_invalid())
        } else {
          console.error('[activate] unexpected error:', err)
          setError(m.portal_activate_error_generic())
        }
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
            {m.portal_activate_title()}
          </Heading>
          <p className="text-sm text-muted-foreground">{m.portal_activate_subtitle()}</p>
        </CardHeader>
        <CardContent>
          {token === undefined || token === '' ? (
            <div className="flex flex-col gap-4">
              <div
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                {m.portal_activate_missing_token()}
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
                name="password"
                children={(field) => (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="password" className="text-sm font-medium">
                      {m.portal_activate_password_label()}
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

              {error !== null && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" loading={isPending} className="w-full">
                {m.portal_activate_submit()}
              </Button>
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
