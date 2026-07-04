import { createFileRoute } from '@tanstack/react-router'

import { m } from '@mr/i18n'

import { MaskedIcon } from '~/components/masked-icon'
import { internalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/pristiglo')({
  beforeLoad: internalRequireRoles(['operator', 'admin']),
  component: PristigloComponent,
})

/** Phase 2 placeholder (README §4): dashed card, blue chip, cog watermark. */
function PristigloComponent() {
  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="mri-fade-up mb-[30px]">
        <h1 className="mb-2 text-[34px] font-extrabold tracking-[-0.02em] text-mri-text">
          {m.nav_pristiglo()}
        </h1>
        <p className="text-[15px] text-mri-text2">{m.internal_pristiglo_subtitle()}</p>
      </div>

      <div
        className="mri-fade-up relative overflow-hidden rounded-2xl border border-dashed border-mri-border2 bg-mri-surface px-10 py-[70px] text-center"
        style={{ animationDelay: '0.12s' }}
      >
        <MaskedIcon
          name="cog"
          spinning
          className="pointer-events-none absolute -right-20 -top-20 size-[220px] text-mri-gear"
        />
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(46,144,250,0.3)] bg-[rgba(46,144,250,0.1)] px-3.5 py-[7px] font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mri-info">
          {m.internal_pristiglo_chip()}
        </span>
        <h2 className="mb-2.5 text-2xl font-extrabold tracking-[-0.01em] text-mri-text">
          {m.internal_pristiglo_empty_title()}
        </h2>
        <p className="mx-auto max-w-[480px] text-[14.5px] leading-[1.6] text-mri-text2">
          {m.internal_pristiglo_empty_body()}
        </p>
      </div>
    </div>
  )
}
