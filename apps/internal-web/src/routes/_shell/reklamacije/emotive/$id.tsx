import {
  ApiError,
  ClaimDetailSearchSchema,
  emotiveClaimDetailOptions,
  prefetchClaimEditReferences,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Skeleton } from '@mr/ui'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Suspense } from 'react'

import { EmotiveClaimDetailView } from '~/features/emotive-claims/detail/emotive-claim-detail'
import { internalRequireEmotiveClaimsView } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/reklamacije/emotive/$id')({
  beforeLoad: internalRequireEmotiveClaimsView(),
  validateSearch: (search) => ClaimDetailSearchSchema.parse(search),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    // Fire-and-forget warm-up of the edit-form catalogs: the first detail
    // open must not block on them. Failures are swallowed here because the
    // same queries re-run (and surface errors) when the edit form mounts.
    void prefetchClaimEditReferences(queryClient).catch(() => undefined)
    await queryClient.ensureQueryData(emotiveClaimDetailOptions(id))
  },
  component: EmotiveClaimDetailPage,
  pendingComponent: EmotiveClaimDetailPending,
  errorComponent: EmotiveClaimDetailError,
})

function BackLink(): React.ReactElement {
  return (
    <Link
      to="/reklamacije"
      search={{ page: 1, pageSize: 10 }}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      {m.emotive_claims_create_back_to_list()}
    </Link>
  )
}

function EmotiveClaimDetailPage(): React.ReactElement {
  const { id } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink />
      <Suspense fallback={<EmotiveClaimDetailSkeleton />}>
        <EmotiveClaimDetailView
          id={id}
          tab={tab}
          onTabChange={(nextTab) => {
            void navigate({ search: { tab: nextTab } })
          }}
        />
      </Suspense>
    </div>
  )
}

function EmotiveClaimDetailPending(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Skeleton className="h-5 w-40" />
      <EmotiveClaimDetailSkeleton />
    </div>
  )
}

function EmotiveClaimDetailSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink />
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">
          {isNotFound ? m.emotive_claims_detail_not_found_title() : m.emotive_claims_error_title()}
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
  )
}
