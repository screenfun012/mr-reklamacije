import { m } from '@mr/i18n'
import { clientClaimsListOptions, clientPortalSummaryOptions } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { MaskedIcon } from '~/components/masked-icon'
import { portalRequireRoles } from '~/lib/auth-guard'
import { usePortalCompany } from '~/lib/use-portal-company'
import { markWelcomeSeen } from '~/lib/welcome-flag'

export const Route = createFileRoute('/welcome')({
  beforeLoad: portalRequireRoles(['client']),
  loader: async ({ context }) => {
    // Prefetch (never throw) — the greeting falls back to the account name and
    // this warms the dashboard cache for the very next navigation.
    await context.queryClient.prefetchQuery(clientClaimsListOptions())
    await context.queryClient.prefetchQuery(clientPortalSummaryOptions())
  },
  component: WelcomeComponent,
})

function GlassCard({
  index,
  title,
  body,
  delay,
}: {
  index: string
  title: string
  body: string
  delay: string
}) {
  return (
    <div
      className="mrp-fade-up-slow rounded-[14px] border border-white/[0.13] bg-[rgba(13,13,16,0.55)] px-5 py-[22px] backdrop-blur-[18px]"
      style={{ animationDelay: delay }}
    >
      <span className="mb-3 block font-mono text-[11px] font-semibold text-[#ff4b52]">{index}</span>
      <div className="mb-1.5 text-base font-bold">{title}</div>
      <div className="text-[13.5px] leading-[1.5] text-white/65">{body}</div>
    </div>
  )
}

function WelcomeComponent() {
  const navigate = useNavigate()
  const { primary: company } = usePortalCompany()

  const handleEnter = (): void => {
    markWelcomeSeen()
    void navigate({ to: '/claims' })
  }

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[#08080a] text-white">
      <img
        src="/portal/hero-misa.jpg"
        alt=""
        className="mrp-ken-burns absolute inset-0 size-full object-cover"
        style={{ objectPosition: '75% 25%' }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,10,0.92)_0%,rgba(8,8,10,0.62)_52%,rgba(8,8,10,0.15)_100%)]" />
      <span
        className="mrp-spin-cog absolute -bottom-[190px] -left-[190px] z-[1] size-[600px] text-white/[0.05]"
        style={{ animation: 'mrpSpin 160s linear infinite' }}
      >
        <MaskedIcon name="cog" className="size-full" />
      </span>

      <div className="relative z-[2] max-w-[880px] px-6 py-16 sm:px-[7vw]">
        <img
          src="/portal/logo-white.png"
          alt="MR Engines"
          className="mrp-fade-up-slow mb-11 h-auto w-[170px]"
          style={{ animationDelay: '0.05s' }}
        />
        <div
          className="mrp-fade-up-slow mb-4 font-mono text-[11.5px] font-semibold tracking-[0.22em] text-[#ff4b52]"
          style={{ animationDelay: '0.15s' }}
        >
          {m.portal_welcome_eyebrow()}
        </div>
        <h1
          className="mrp-fade-up-slow mb-4 text-balance text-[clamp(42px,4.6vw,62px)] font-extrabold leading-[1.05] tracking-[-0.02em]"
          style={{ animationDelay: '0.25s' }}
        >
          {m.portal_welcome_hello({ company })}
        </h1>
        <p
          className="mrp-fade-up-slow mb-10 max-w-[540px] text-pretty text-lg leading-[1.55] text-white/75"
          style={{ animationDelay: '0.35s' }}
        >
          {m.portal_welcome_intro()}
        </p>

        <div className="mb-[42px] grid max-w-[780px] grid-cols-1 gap-3.5 sm:grid-cols-3">
          <GlassCard
            index="01"
            title={m.portal_welcome_card_1_title()}
            body={m.portal_welcome_card_1_body()}
            delay="0.45s"
          />
          <GlassCard
            index="02"
            title={m.portal_welcome_card_2_title()}
            body={m.portal_welcome_card_2_body()}
            delay="0.55s"
          />
          <GlassCard
            index="03"
            title={m.portal_welcome_card_3_title()}
            body={m.portal_welcome_card_3_body()}
            delay="0.65s"
          />
        </div>

        <button
          type="button"
          onClick={handleEnter}
          className="mrp-fade-up-slow inline-flex h-[54px] cursor-pointer items-center gap-2.5 rounded-[10px] border-none bg-[#f2f2f3] px-[38px] font-sans text-[15px] font-bold uppercase tracking-[0.09em] text-[#101013] shadow-[0_16px_38px_rgba(0,0,0,0.4)] transition-[background,transform] duration-200 hover:-translate-y-px hover:bg-white active:translate-y-0 active:scale-[0.99]"
          style={{ animationDelay: '0.75s' }}
        >
          {m.portal_welcome_cta()}
          <span className="font-normal">→</span>
        </button>
      </div>
    </main>
  )
}
