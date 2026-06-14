import { ApiError, emotiveClaimDetailOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Skeleton } from '@mr/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'

import { InternalShell } from '~/components/layout/internal-shell'
import { EmotiveClaimDetailView } from '~/features/emotive-claims/detail/emotive-claim-detail'
import { internalRequireEmotiveClaimsView } from '~/lib/auth-guard'

export const Route = createFileRoute('/reklamacije/emotive/$id')({
  beforeLoad: internalRequireEmotiveClaimsView(),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    await queryClient.ensureQueryData(emotiveClaimDetailOptions(id))
  },
  component: EmotiveClaimDetailPage,
  pendingComponent: EmotiveClaimDetailPending,
  errorComponent: EmotiveClaimDetailError,
})

function DetailHeader(): React.ReactElement {
  return (
    <div>
      <Link
        to="/reklamacije"
        search={{ page: 1, pageSize: 10 }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {m.emotive_claims_create_back_to_list()}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{m.emotive_claims_detail_title()}</h1>
    </div>
  )
}

function EmotiveClaimDetailPage(): React.ReactElement {
  const { id } = Route.useParams()

  return (
    <InternalShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <DetailHeader />
        <Suspense fallback={<EmotiveClaimDetailSkeleton />}>
          <EmotiveClaimDetailView id={id} />
        </Suspense>
      </div>
    </InternalShell>
  )
}

function EmotiveClaimDetailPending(): React.ReactElement {
  return (
    <InternalShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <EmotiveClaimDetailSkeleton />
      </div>
    </InternalShell>
  )
}

function EmotiveClaimDetailSkeleton(): React.ReactElement {
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

function EmotiveClaimDetailError({
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
            {isNotFound
              ? m.emotive_claims_detail_not_found_title()
              : m.emotive_claims_error_title()}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNotFound
              ? m.emotive_claims_detail_not_found_description()
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
