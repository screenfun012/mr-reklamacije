import { m } from '@mr/i18n'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { portalRequireRoles } from '~/lib/auth-guard'
import { markWelcomeSeen } from '~/lib/welcome-flag'

export const Route = createFileRoute('/welcome')({
  beforeLoad: portalRequireRoles(['client', 'admin']),
  component: WelcomeComponent,
})

function WelcomeComponent() {
  const navigate = useNavigate()

  const handleEnter = (): void => {
    markWelcomeSeen()
    void navigate({ to: '/claims' })
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-mr-bg-base px-6 text-center">
      {/* top radial-red glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(70% 55% at 50% 0%, rgba(237,28,36,0.16), transparent 60%)',
        }}
      />
      {/* blueprint grid, radially masked */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(90% 70% at 50% 30%, #000 25%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(90% 70% at 50% 30%, #000 25%, transparent 75%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <img
          src="/mr-crest.png"
          alt="MR Engines"
          className="animate-mr-fade-up h-[74px] w-auto"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="animate-mr-line h-[3px] w-[60px] bg-primary"
          style={{ animationDelay: '250ms' }}
          aria-hidden="true"
        />
        <h1
          className="animate-mr-fade-up max-w-2xl text-[clamp(30px,4vw,42px)] font-extrabold tracking-[-0.02em] text-foreground"
          style={{ animationDelay: '350ms' }}
        >
          {m.portal_welcome_title()}
        </h1>
        <p
          className="animate-mr-fade-up max-w-xl text-[15px] leading-relaxed text-mr-text-body"
          style={{ animationDelay: '550ms' }}
        >
          {m.portal_welcome_subtitle()}
        </p>
        <div className="animate-mr-fade-up mt-2" style={{ animationDelay: '800ms' }}>
          <button
            type="button"
            onClick={handleEnter}
            className="mr-shear inline-flex items-center gap-2 bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-mr-brand-400"
          >
            <span className="mr-shear-content inline-flex items-center gap-2">
              {m.portal_welcome_enter()}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>
    </main>
  )
}
