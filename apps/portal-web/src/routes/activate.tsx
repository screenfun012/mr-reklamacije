import { useState } from 'react'

import { m } from '@mr/i18n'
import { ApiError, PASSWORD_MIN_LENGTH, completeActivation, formatFieldError } from '@mr/shared'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { LangThemeControls } from '~/components/lang-theme-controls'
import { PortalLogo } from '~/components/masked-icon'
import { PortalButton } from '~/components/portal-button'
import { PortalFieldError, PortalInput, PortalLabel } from '~/components/portal-field'

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

  const missingToken = token === undefined || token === ''

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-mrp-bg p-6 sm:p-10">
      <img
        src="/portal/bg-workshop.jpg"
        alt=""
        className="absolute inset-0 size-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.85),rgba(9,9,11,0.96))]" />

      <div className="absolute right-8 top-7 z-[3]">
        <LangThemeControls />
      </div>

      <div className="mrp-pop-in relative w-full max-w-[460px] rounded-[18px] border border-mrp-border bg-mrp-surface px-8 pb-10 pt-11 shadow-[var(--mrp-shadow)] sm:px-[42px]">
        <PortalLogo className="mb-[30px] h-10 w-[150px]" />

        <h1 className="mb-2 text-[26px] font-extrabold tracking-[-0.02em]">
          {m.portal_activate_title()}
        </h1>
        <p className="mb-7 text-[15px] leading-[1.55] text-mrp-text2">
          {m.portal_activate_subtitle()}
        </p>

        {missingToken ? (
          <div className="flex flex-col gap-5">
            <div
              role="alert"
              className="rounded-[10px] border border-[rgba(217,45,32,0.36)] bg-mrp-bad-bg p-3 text-sm text-mrp-bad"
            >
              {m.portal_activate_missing_token()}
            </div>
            <Link to="/login" className="text-sm font-bold text-mrp-redh hover:underline">
              {m.portal_pending_back()}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            noValidate
          >
            <form.Field
              name="password"
              children={(field) => (
                <div className="mb-6">
                  <PortalLabel htmlFor="password">{m.portal_activate_password_label()}</PortalLabel>
                  <PortalInput
                    id="password"
                    type="password"
                    autoComplete="new-password"
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

            {error !== null && (
              <div
                role="alert"
                className="mb-5 rounded-[10px] border border-[rgba(217,45,32,0.36)] bg-mrp-bad-bg p-3 text-sm text-mrp-bad"
              >
                {error}
              </div>
            )}

            <PortalButton type="submit" disabled={isPending}>
              {m.portal_activate_submit()}
              <span className="font-normal">→</span>
            </PortalButton>
          </form>
        )}
      </div>
    </main>
  )
}
