import { useState } from 'react'

import { useForm } from '@tanstack/react-form'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PASSWORD_MIN_LENGTH, formatFieldError } from '@mr/shared'
import { m } from '@mr/i18n'

import { AuthHeroPanel } from '~/components/auth/auth-hero-panel'
import { AuthTextField } from '~/components/auth/auth-text-field'
import { InternalButton, internalButtonClasses } from '~/components/internal-button'
import { InternalNote } from '~/components/internal-note'
import { InternalLogo } from '~/components/masked-icon'
import { authClient } from '~/lib/auth-client'
import { showInternalToast } from '~/lib/internal-toast'

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
})

const registerSchema = z.object({
  firstName: z.string().min(1, m.field_first_name_required()),
  lastName: z.string().min(1, m.field_last_name_required()),
  email: z.email(m.field_email_invalid()),
  password: z.string().min(PASSWORD_MIN_LENGTH, m.field_password_min_length()),
})

function fieldError(errors: ReadonlyArray<unknown>): string | null {
  return errors.length > 0 ? formatFieldError(errors[0]) : null
}

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
        showInternalToast(m.internal_toast_registration_sent())
      } catch (err) {
        console.error('[register] unexpected error:', err)
        setFormError(m.auth_register_error_generic())
      } finally {
        setIsPending(false)
      }
    },
  })

  return (
    <main className="flex min-h-screen bg-mri-bg font-sans text-mri-text">
      <AuthHeroPanel variant="register" />

      <div className="relative grid min-w-0 flex-1 place-items-center overflow-hidden px-10 py-12 lg:min-w-[460px]">
        <div aria-hidden="true" className="mri-grid-bg absolute inset-0" />

        <div
          className="mri-fade-up relative z-[2] w-full max-w-[396px]"
          style={{ animationDelay: '0.1s' }}
        >
          <InternalLogo className="mb-9 h-8 w-[124px] lg:hidden" />

          <h1 className="mb-2 text-[30px] font-extrabold tracking-[-0.02em]">
            {m.auth_register_title()}
          </h1>
          <p className="mb-7 text-[15px] text-mri-text2">{m.internal_register_subtitle()}</p>

          {isSuccess ? (
            <div className="flex flex-col gap-5">
              <InternalNote tone="info" role="status">
                {m.auth_register_success_pending()}
              </InternalNote>
              <Link to="/login" className={internalButtonClasses('outline')}>
                {m.auth_register_back_to_login()}
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
              className="flex flex-col"
              noValidate
            >
              <div className="mb-4 grid grid-cols-2 gap-3">
                <form.Field
                  name="firstName"
                  children={(field) => (
                    <AuthTextField
                      id="firstName"
                      label={m.auth_register_first_name()}
                      autoComplete="given-name"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      disabled={isPending}
                      error={fieldError(field.state.meta.errors)}
                    />
                  )}
                />
                <form.Field
                  name="lastName"
                  children={(field) => (
                    <AuthTextField
                      id="lastName"
                      label={m.auth_register_last_name()}
                      autoComplete="family-name"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      disabled={isPending}
                      error={fieldError(field.state.meta.errors)}
                    />
                  )}
                />
              </div>

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
                    error={fieldError(field.state.meta.errors)}
                    className="mb-4"
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
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    disabled={isPending}
                    error={fieldError(field.state.meta.errors)}
                    className="mb-[18px]"
                  />
                )}
              />

              <InternalNote tone="info" className="mb-6">
                {m.internal_register_note()}
              </InternalNote>

              {formError !== null ? (
                <InternalNote tone="error" role="alert" className="mb-5">
                  {formError}
                </InternalNote>
              ) : null}

              <InternalButton type="submit" disabled={isPending}>
                {m.auth_register_submit()} <span className="font-normal">→</span>
              </InternalButton>

              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-mri-text2">
                {m.internal_register_have_account()}
                <Link to="/login" className="font-bold text-mri-redh hover:underline">
                  {m.auth_login_title()}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
