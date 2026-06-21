import { Suspense } from 'react'

import { prefetchClaimEditReferences } from '@mr/shared'
import { m } from '@mr/i18n'
import { Heading, Skeleton } from '@mr/ui'
import { createFileRoute, Link } from '@tanstack/react-router'

import { InternalShell } from '~/components/layout/internal-shell'
import { DomaceClaimCreateForm } from '~/features/domace-claims/create/domace-claim-create-form'
import { internalRequireDomaceClaimsCreate } from '~/lib/auth-guard'

export const Route = createFileRoute('/reklamacije/domace/nova')({
  beforeLoad: internalRequireDomaceClaimsCreate(),
  loader: async ({ context: { queryClient } }) => {
    await prefetchClaimEditReferences(queryClient)
  },
  component: DomaceClaimNovaPage,
  pendingComponent: DomaceClaimNovaPending,
})

function DomaceClaimNovaPage(): React.ReactElement {
  return (
    <InternalShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <Link
            to="/reklamacije"
            search={{ page: 1, pageSize: 10 }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {m.domace_claims_create_back_to_list()}
          </Link>
          <Heading level="h1" className="mt-2">
            {m.domace_claims_new_claim()}
          </Heading>
        </div>
        <Suspense fallback={<DomaceClaimCreateSkeleton />}>
          <DomaceClaimCreateForm />
        </Suspense>
      </div>
    </InternalShell>
  )
}

function DomaceClaimNovaPending(): React.ReactElement {
  return (
    <InternalShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <DomaceClaimCreateSkeleton />
      </div>
    </InternalShell>
  )
}

function DomaceClaimCreateSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-1/3 self-end" />
    </div>
  )
}
