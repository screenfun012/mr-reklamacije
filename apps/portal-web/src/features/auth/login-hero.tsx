import { m } from '@mr/i18n'

// Left brand hero for the login split (design 1a). Dark radial-red backdrop +
// blueprint grid + breathing glow + faint crest watermark, then the heritage
// eyebrow / headline / subtitle / stat row. Pure presentation, P0 tokens only.

function Eyebrow({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="mr-shear inline-block h-3 w-3 bg-primary" aria-hidden="true">
        <span className="mr-shear-content sr-only">•</span>
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mr-text-body">
        {children}
      </span>
    </div>
  )
}

function Stat({ value, plus, label }: { value: string; plus?: boolean; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[38px] font-extrabold leading-none text-foreground">
        {value}
        {plus === true ? <span className="text-primary">+</span> : null}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mr-text-tertiary">
        {label}
      </span>
    </div>
  )
}

export function LoginHero() {
  return (
    <div
      className="relative hidden flex-[1.15] overflow-hidden lg:flex"
      style={{
        background:
          'radial-gradient(120% 95% at 16% 34%, rgba(237,28,36,0.15), transparent 52%), linear-gradient(158deg, #1e1f21, #101010)',
      }}
    >
      {/* blueprint grid, radially masked */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(120% 100% at 30% 20%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(120% 100% at 30% 20%, #000 30%, transparent 75%)',
        }}
      />

      {/* breathing red glow */}
      <div
        aria-hidden="true"
        className="mr-breathe pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(60% 50% at 20% 38%, rgba(237,28,36,0.28), transparent 60%)',
        }}
      />

      {/* faint crest watermark */}
      <img
        src="/mr-crest.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-6 -right-6 w-72 opacity-[0.06]"
      />

      <div className="relative z-10 flex flex-col justify-center gap-8 px-14 py-16">
        <Eyebrow>{m.portal_login_hero_eyebrow()}</Eyebrow>

        <h1 className="max-w-xl text-[clamp(33px,4.2vw,54px)] font-extrabold leading-[1.05] tracking-[-0.025em] text-foreground">
          {m.portal_login_hero_title()}
        </h1>

        <p className="max-w-md text-[15px] leading-relaxed text-mr-text-body">
          {m.portal_login_hero_subtitle()}
        </p>

        <div className="mt-2 flex items-stretch gap-7">
          <Stat value="60" plus label={m.portal_login_stat_years_label()} />
          <div className="w-px bg-mr-border-strong" aria-hidden="true" />
          <Stat value="3" label={m.portal_login_stat_gen_label()} />
          <div className="w-px bg-mr-border-strong" aria-hidden="true" />
          <Stat value="150" label={m.portal_login_stat_team_label()} />
        </div>
      </div>
    </div>
  )
}
