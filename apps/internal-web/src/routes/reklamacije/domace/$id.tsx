import {
  ApiError,
  departmentsReferenceOptions,
  domaceClaimDetailOptions,
  employeesReferenceOptions,
  engineTypesReferenceOptions,
  externalPartiesReferenceOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Skeleton } from '@mr/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'

import { InternalShell } from '~/components/layout/internal-shell'
import { DomaceClaimDetailView } from '~/features/domace-claims/detail/domace-claim-detail'
import { internalRequireDomaceClaimsView } from '~/lib/auth-guard'

export const Route = createFileRoute('/reklamacije/domace/$id')({
  beforeLoad: internalRequireDomaceClaimsView(),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    void queryClient.ensureQueryData(departmentsReferenceOptions({ activeOnly: true }))
    void queryClient.ensureQueryData(employeesReferenceOptions({ activeOnly: true }))
    void queryClient.ensureQueryData(externalPartiesReferenceOptions({ activeOnly: true }))
    void queryClient.ensureQueryData(engineTypesReferenceOptions({ activeOnly: true }))
    await queryClient.ensureQueryData(domaceClaimDetailOptions(id))
  },
  component: DomaceClaimDetailPage,
  pendingComponent: DomaceClaimDetailPending,
  errorComponent: DomaceClaimDetailError,
})

function DetailHeader(): React.ReactElement {
  return (
    <div>
      <Link
        to="/reklamacije"
        search={{ page: 1, pageSize: 10 }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {m.domace_claims_create_back_to_list()}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{m.domace_claims_detail_title()}</h1>
    </div>
  )
}

function DomaceClaimDetailPage(): React.ReactElement {
  const { id } = Route.useParams()

  return (
    <InternalShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <DetailHeader />
        <Suspense fallback={<DomaceClaimDetailSkeleton />}>
          <DomaceClaimDetailView id={id} />
        </Suspense>
      </div>
    </InternalShell>
  )
}

function DomaceClaimDetailPending(): React.ReactElement {
  return (
    <InternalShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <DomaceClaimDetailSkeleton />
      </div>
    </InternalShell>
  )
}

function DomaceClaimDetailSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-6" aria-busy="true">
      <Skeleton className="h-6 w-64" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

function DomaceClaimDetailError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}): React.ReactElement {
  const isNotFound = error instanceof ApiError && error.status === 404

  return (
    <InternalShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <DetailHeader />
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
          role="alert"
        >
          <p className="text-sm font-medium text-foreground">
            {isNotFound ? m.domace_claims_detail_not_found_title() : m.emotive_claims_error_title()}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNotFound
              ? m.domace_claims_detail_not_found_description()
              : m.emotive_claims_error_description()}
          </p>
          {isNotFound ? null : (
            <Button type="button" variant="outline" className="mt-4" onClick={reset}>
              {m.emotive_claims_error_retry()}
            </Button>
          )}
        </div>
      </div>
    </InternalShell>
  )
}
