import { m } from '@mr/i18n'
import { PORTAL_SUPPORT_EMAIL } from '@mr/shared'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { LangThemeControls } from '~/components/lang-theme-controls'
import { MaskedIcon, PortalLogo } from '~/components/masked-icon'
import { PortalButton } from '~/components/portal-button'

/**
 * Pending-approval screen: shown right after a signup request AND whenever an
 * unapproved account tries to sign in (login routes here on the pending error).
 */
export const Route = createFileRoute('/pending')({
  component: PendingComponent,
})

function PendingComponent(): React.ReactElement {
  const navigate = useNavigate()

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-mrp-bg p-10">
      <img
        src="/portal/bg-workshop.jpg"
        alt=""
        className="absolute inset-0 size-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.85),rgba(9,9,11,0.96))]" />

      <div className="absolute right-8 top-7 z-[3]">
        <LangThemeControls />
      </div>

      <div className="mrp-pop-in relative w-full max-w-[520px] overflow-hidden rounded-[18px] border border-mrp-border bg-mrp-surface px-8 pb-10 pt-11 shadow-[var(--mrp-shadow)] sm:px-[46px]">
        <span
          className="mrp-spin-cog absolute -right-[90px] -top-[90px] size-[230px] text-mrp-gear"
          style={{ animation: 'mrpSpin 60s linear infinite' }}
        >
          <MaskedIcon name="cog" className="size-full" />
        </span>

        <PortalLogo className="mb-[30px] h-10 w-[150px]" />

        <span className="mb-[22px] inline-flex items-center gap-2 rounded-full border border-[rgba(245,166,35,0.38)] bg-[rgba(245,166,35,0.12)] px-3.5 py-[7px] font-mono text-[10.5px] font-semibold tracking-[0.18em] text-mrp-warn">
          <span className="mrp-ring-warn size-2 rounded-full bg-mrp-warn" />
          {m.portal_pending_chip()}
        </span>

        <h1 className="mb-3 text-[29px] font-extrabold tracking-[-0.02em]">
          {m.portal_pending_title()}
        </h1>
        <p className="mb-[30px] text-[15px] leading-[1.6] text-mrp-text2">
          {m.portal_pending_body()}
        </p>

        <div className="mb-8 flex flex-col">
          <div className="flex items-start gap-3.5">
            <div className="flex flex-col items-center">
              <MaskedIcon name="check" className="size-[15px] text-mrp-ok" />
              <span className="h-6 w-0.5 bg-mrp-ok" />
            </div>
            <span className="-mt-px text-[14.5px] font-semibold">{m.portal_pending_step_1()}</span>
          </div>
          <div className="flex items-start gap-3.5">
            <div className="flex flex-col items-center">
              <MaskedIcon name="cog" spinning className="size-[15px] text-mrp-warn" />
              <span className="h-6 w-0.5 bg-mrp-border" />
            </div>
            <span className="-mt-px text-[14.5px] font-semibold text-mrp-warn">
              {m.portal_pending_step_2()}
            </span>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="box-border size-[13px] flex-none rounded-full border-2 border-mrp-border2 bg-transparent" />
            <span className="text-[14.5px] text-mrp-text2">{m.portal_pending_step_3()}</span>
          </div>
        </div>

        <PortalButton
          type="button"
          variant="secondary"
          className="h-12 w-auto px-[26px] text-[13px]"
          onClick={() => {
            void navigate({ to: '/login' })
          }}
        >
          {m.portal_pending_back()}
        </PortalButton>

        <p className="mb-0 mt-[26px] font-mono text-[11px] tracking-[0.04em] text-mrp-text2">
          {m.portal_pending_help({ email: PORTAL_SUPPORT_EMAIL })}
        </p>
      </div>
    </main>
  )
}
