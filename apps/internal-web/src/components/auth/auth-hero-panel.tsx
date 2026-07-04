import { m } from '@mr/i18n'
import { cn } from '@mr/ui'

import { MaskedIcon } from '~/components/masked-icon'

const TRUST_ROWS = [
  m.internal_hero_trust_registry,
  m.internal_hero_trust_excel,
  m.internal_hero_trust_stats,
]

const MARQUEE_ITEMS = [
  m.internal_marquee_engine,
  m.internal_marquee_head,
  m.internal_marquee_crankshaft,
  m.internal_marquee_block,
  m.internal_marquee_since,
]

/**
 * Left photo panel of the auth split layout: workshop photo with Ken-Burns
 * zoom, dark gradient, faded blueprint grid and hero copy. Always dark
 * regardless of theme (constant overlay colors by design). Hidden below `lg` —
 * the form takes the full screen there and shows its own logo.
 */
export function AuthHeroPanel({ variant }: { variant: 'login' | 'register' }) {
  // 4 copies + translateX(-50%) = seamless loop (two full sets per half).
  const marquee = [1, 2, 3, 4].flatMap((copy) =>
    MARQUEE_ITEMS.map((item, index) => ({ key: `${copy}-${index}`, label: item() })),
  )

  return (
    <div className="relative hidden min-w-0 flex-[1.22] flex-col overflow-hidden bg-[#08080a] lg:flex">
      <img
        src="/internal/bg-workshop.jpg"
        alt=""
        className="mri-ken-burns absolute inset-0 size-full object-cover opacity-90"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(196deg,rgba(8,8,10,0.12)_0%,rgba(8,8,10,0.55)_55%,rgba(8,8,10,0.92)_100%)]"
      />
      <div
        aria-hidden="true"
        className="mri-grid-fade-up absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:56px_56px]"
      />
      {variant === 'login' ? (
        <MaskedIcon
          name="cog"
          spinning
          className="pointer-events-none absolute -bottom-[140px] -right-[140px] size-[520px] text-white/[0.06]"
        />
      ) : null}

      <img
        src="/internal/logo-white.png"
        alt="MR Engines"
        className="relative z-[2] ml-[46px] mt-[42px] w-[180px]"
      />

      <div
        className={cn(
          'relative z-[2] ml-[46px] mr-16 mt-auto text-white',
          variant === 'login' ? 'pb-11' : 'mb-11',
        )}
      >
        <div
          className="mri-fade-up mb-4 font-mono text-[11.5px] font-semibold uppercase tracking-[0.22em] text-[#ff4b52]"
          style={{ animationDelay: '0.1s' }}
        >
          {m.internal_app_eyebrow()} — EST. 1968
        </div>
        <h1
          className="mri-fade-up mb-3.5 text-[clamp(34px,3.3vw,50px)] font-extrabold leading-[1.07] tracking-[-0.02em]"
          style={{ animationDelay: '0.2s' }}
        >
          {m.internal_hero_title()}
        </h1>
        <p
          className={cn(
            'mri-fade-up max-w-[470px] text-[16.5px] leading-[1.55] text-white/70',
            variant === 'login' ? 'mb-[34px]' : 'mb-0',
          )}
          style={{ animationDelay: '0.3s' }}
        >
          {m.internal_hero_subtitle()}
        </p>
        {variant === 'login' ? (
          <div className="flex flex-col gap-[13px]">
            {TRUST_ROWS.map((row, index) => (
              <div
                key={row()}
                className="mri-fade-up flex items-center gap-3.5"
                style={{ animationDelay: `${0.4 + index * 0.1}s` }}
              >
                <MaskedIcon name="check" className="size-4 text-[#ff4b52]" />
                <span className="text-[15px] text-white/85">{row()}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {variant === 'login' ? (
        <div className="relative z-[2] overflow-hidden border-t border-white/[0.12] bg-[rgba(8,8,10,0.55)] py-[11px] backdrop-blur-lg">
          <div className="mri-marquee-track flex w-max">
            {marquee.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-[26px] whitespace-nowrap pr-[26px] font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45"
              >
                {item.label}
                <span aria-hidden="true" className="size-[5px] flex-none rotate-45 bg-mri-red" />
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
