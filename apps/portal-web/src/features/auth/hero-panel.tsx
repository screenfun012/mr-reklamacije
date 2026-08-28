import { m } from '@mr/i18n'

import { ServicesMarquee } from '~/components/marquee'
import { MaskedIcon } from '~/components/masked-icon'

function TrustRow({ label, delay }: { label: string; delay: string }) {
  return (
    <div className="mrp-fade-up-slow flex items-center gap-3.5" style={{ animationDelay: delay }}>
      <MaskedIcon name="check" className="size-4 text-[#ff4b52]" />
      <span className="text-[15px] text-white/85">{label}</span>
    </div>
  )
}

/**
 * Left brand panel of login/signup: workshop photo with Ken-Burns zoom, dark
 * gradient, blueprint grid, hero copy. The login variant adds the trust rows,
 * the giant watermark cog and the services marquee.
 */
export function HeroPanel({ variant }: { variant: 'login' | 'signup' }) {
  return (
    <div className="relative hidden min-w-0 flex-[1.22] flex-col overflow-hidden bg-[#08080a] lg:flex">
      <img
        src="/portal/bg-workshop.jpg"
        alt="MR Engines workshop"
        className="mrp-ken-burns absolute inset-0 size-full object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-[linear-gradient(196deg,rgba(8,8,10,0.22)_0%,rgba(8,8,10,0.72)_55%,rgba(8,8,10,0.96)_100%)]" />
      <div
        className="mrp-grid-fade-up absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.045) 1px,transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      {variant === 'login' && (
        <span
          className="mrp-spin-cog absolute -bottom-[140px] -right-[140px] size-[520px] text-white/[0.06]"
          style={{ animation: 'mrpSpin 150s linear infinite' }}
        >
          <MaskedIcon name="cog" className="size-full" />
        </span>
      )}

      <img
        src="/portal/logo-white.png"
        alt="MR Engines"
        className="relative z-[2] ml-[46px] mt-[42px] h-auto w-[180px]"
      />

      <div className="relative z-[2] mb-0 ml-[46px] mr-16 mt-auto pb-11 text-white">
        <div
          className="mrp-fade-up-slow mb-4 font-mono text-[11.5px] font-semibold tracking-[0.22em] text-[#ff4b52]"
          style={{ animationDelay: '0.1s' }}
        >
          {m.portal_hero_eyebrow()}
        </div>
        <h1
          className="mrp-fade-up-slow mb-3.5 text-balance text-[clamp(34px,3.3vw,50px)] font-extrabold leading-[1.07] tracking-[-0.02em]"
          style={{ animationDelay: '0.2s' }}
        >
          {m.portal_hero_title()}
        </h1>
        <p
          className="mrp-fade-up-slow max-w-[470px] text-pretty text-[16.5px] leading-[1.55] text-white/70"
          style={{ animationDelay: '0.3s', marginBottom: variant === 'login' ? 34 : 0 }}
        >
          {m.portal_hero_subtitle()}
        </p>
        {variant === 'login' && (
          <div className="flex flex-col gap-[13px]">
            <TrustRow label={m.portal_hero_trust_1()} delay="0.4s" />
            <TrustRow label={m.portal_hero_trust_2()} delay="0.5s" />
            <TrustRow label={m.portal_hero_trust_3()} delay="0.6s" />
          </div>
        )}
      </div>

      {variant === 'login' && <ServicesMarquee />}
    </div>
  )
}
