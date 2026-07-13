import { m } from '@mr/i18n'
import { clientClaimsListOptions } from '@mr/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { PortalHeader } from '~/components/portal-header'
import { ReportForm } from '~/features/report/report-form'
import { authClient } from '~/lib/auth-client'
import { portalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/report')({
  beforeLoad: portalRequireRoles(['client']),
  component: ReportComponent,
})

function ReportComponent() {
  const { data: session } = authClient.useSession()
  // Cached from the dashboard; falls back to the account name (no extra fetch cost).
  const { data: claims } = useQuery(clientClaimsListOptions())
  const company = claims?.items[0]?.customerName ?? session?.user.name ?? ''

  return (
    <div className="relative min-h-screen overflow-hidden bg-mrp-bg">
      <div
        className="mrp-grid-bg absolute inset-0"
        style={{
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 45%)',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 45%)',
        }}
      />
      <PortalHeader company={company} maxWidthClass="max-w-[760px]" />

      <div className="relative mx-auto max-w-[760px] px-5 pb-[72px] pt-8 sm:px-8">
        <Link
          to="/claims"
          className="mrp-fade-up mb-[22px] inline-block text-sm font-semibold text-mrp-text2 transition-colors hover:text-mrp-redh"
        >
          {m.portal_detail_back()}
        </Link>

        <div className="mrp-fade-up mb-8" style={{ animationDelay: '0.05s' }}>
          <h1 className="mb-2 text-[30px] font-extrabold tracking-[-0.02em] sm:text-[34px]">
            {m.portal_submit_title()}
          </h1>
          <p className="text-[15px] leading-[1.55] text-mrp-text2">{m.portal_submit_subtitle()}</p>
        </div>

        <div
          className="mrp-fade-up rounded-[15px] border border-mrp-border bg-mrp-surface p-7 sm:p-8"
          style={{ animationDelay: '0.1s' }}
        >
          <ReportForm />
        </div>
      </div>
    </div>
  )
}
