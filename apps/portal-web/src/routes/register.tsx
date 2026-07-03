import { useState } from 'react'

import { m } from '@mr/i18n'
import { registerClient, formatFieldError } from '@mr/shared'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { LangThemeControls } from '~/components/lang-theme-controls'
import { PortalButton } from '~/components/portal-button'
import { PortalFieldError, PortalInput, PortalLabel } from '~/components/portal-field'
import { HeroPanel } from '~/features/auth/hero-panel'

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
})

const registerSchema = z.object({
  companyName: z.string().trim().min(1, m.portal_register_company_required()),
  name: z.string().trim().min(1, m.portal_register_name_required()),
  email: z.email(m.field_email_invalid()),
})

interface SignupField {
  key: 'companyName' | 'name' | 'email'
  label: string
  type: string
  autoComplete: string
  placeholder?: string
}

function RegisterComponent(): React.ReactElement {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const form = useForm({
    defaultValues: { companyName: '', name: '', email: '' },
    validators: {
      onChange: registerSchema,
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      setIsPending(true)
      try {
        await registerClient({
          name: value.name.trim(),
          email: value.email.trim(),
          companyName: value.companyName.trim(),
        })
        await navigate({ to: '/pending' })
      } catch (err) {
        console.error('[register] unexpected error:', err)
        setSubmitError(m.portal_activate_error_generic())
      } finally {
        setIsPending(false)
      }
    },
  })

  // The account has no password at this stage BY DESIGN: it is set through the
  // activation email after MR staff approve the request (see the pending screen).
  const fields: SignupField[] = [
    {
      key: 'companyName',
      label: m.portal_signup_company_label(),
      type: 'text',
      autoComplete: 'organization',
      placeholder: 'Auto Servis d.o.o.',
    },
    {
      key: 'name',
      label: m.portal_signup_contact_label(),
      type: 'text',
      autoComplete: 'name',
    },
    {
      key: 'email',
      label: m.portal_login_email_label(),
      type: 'email',
      autoComplete: 'email',
      placeholder: 'name@company.com',
    },
  ]

  return (
    <main className="flex min-h-screen bg-mrp-bg">
      <HeroPanel variant="signup" />

      <div className="relative grid min-h-screen flex-1 place-items-center overflow-hidden bg-mrp-bg px-6 py-12 lg:min-w-[460px] lg:px-10">
        <div className="mrp-grid-bg absolute inset-0" />
        <div className="absolute right-8 top-7 z-[3]">
          <LangThemeControls />
        </div>

        <div
          className="mrp-fade-up relative z-[2] w-full max-w-[396px]"
          style={{ animationDelay: '0.1s' }}
        >
          <h1 className="mb-2 text-[30px] font-extrabold tracking-[-0.02em]">
            {m.portal_signup_title()}
          </h1>
          <p className="mb-7 text-[15px] text-mrp-text2">{m.portal_signup_subtitle()}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            noValidate
          >
            {fields.map((f) => (
              <form.Field
                key={f.key}
                name={f.key}
                children={(field) => (
                  <div className="mb-4">
                    <PortalLabel htmlFor={f.key}>{f.label}</PortalLabel>
                    <PortalInput
                      id={f.key}
                      type={f.type}
                      autoComplete={f.autoComplete}
                      placeholder={f.placeholder}
                      className="h-[46px] px-[15px] text-[15px]"
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
            ))}

            <div className="mb-6 mt-0.5 flex gap-[11px] rounded-[10px] border border-[rgba(46,144,250,0.26)] bg-[rgba(46,144,250,0.09)] px-[15px] py-[13px]">
              <span className="mt-[5px] size-2 flex-none rounded-full bg-mrp-info" />
              <span className="text-[13.5px] leading-[1.5] text-mrp-text2">
                {m.portal_signup_note()}
              </span>
            </div>

            {submitError !== null && (
              <div
                role="alert"
                className="mb-5 rounded-[10px] border border-[rgba(217,45,32,0.36)] bg-mrp-bad-bg p-3 text-sm text-mrp-bad"
              >
                {submitError}
              </div>
            )}

            <PortalButton type="submit" disabled={isPending}>
              {m.portal_signup_submit()}
              <span className="font-normal">→</span>
            </PortalButton>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-mrp-text2">
            {m.portal_signup_have_account()}
            <Link to="/login" className="font-bold text-mrp-redh hover:underline">
              {m.portal_login_title()}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
