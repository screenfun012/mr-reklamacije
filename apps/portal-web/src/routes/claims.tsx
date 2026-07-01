import { m } from '@mr/i18n'
import { ClaimOutcome, CLIENT_CLAIMS_FETCH_PAGE_SIZE, clientClaimsListOptions } from '@mr/shared'
import { Button } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { PortalShell } from '~/components/layout/portal-shell'
import { ClientClaimsList } from '~/features/claims/client-claims-list'
import { ClientClaimsSkeleton } from '~/features/claims/client-claims-skeleton'
import { portalRequireRoles } from '~/lib/auth-guard'

export const Route = createFileRoute('/claims')({
  beforeLoad: portalRequireRoles(['client', 'admin']),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(clientClaimsListOptions())
  },
  component: ClaimsComponent,
  pendingComponent: ClaimsPending,
  errorComponent: ClaimsError,
})

function ClaimsComponent() {
  const { data } = useSuspenseQuery(clientClaimsListOptions())
  // Archived is an internal state — never shown to clients (decision #5).
  const claims = data.items.filter((claim) => claim.outcome !== ClaimOutcome.Archived)
  const company = claims[0]?.customerName ?? undefined
  // Fetch hit its cap → there may be more claims than one client-side page can hold.
  const capped = data.items.length >= CLIENT_CLAIMS_FETCH_PAGE_SIZE

  return (
    <PortalShell company={company}>
      <ClientClaimsList claims={claims} capped={capped} />
    </PortalShell>
  )
}

function ClaimsPending() {
  return (
    <PortalShell>
      <ClientClaimsSkeleton />
    </PortalShell>
  )
}

function ClaimsError({ reset }: { reset: () => void }) {
  return (
    <PortalShell>
      <div
        className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-16 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">{m.portal_claims_error_title()}</p>
        <p className="mt-1 text-sm text-muted-foreground">{m.portal_claims_error_description()}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={reset}>
          {m.portal_claims_error_retry()}
        </Button>
      </div>
    </PortalShell>
  )
}
