import { ClaimDetailSearchSchema, emotiveClaimDetailOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Skeleton } from '@mr/ui'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Suspense } from 'react'

import { EmotiveClaimDetailView } from '~/features/emotive-claims/detail/emotive-claim-detail'
import { internalRequireEmotiveClaimsView } from '~/lib/auth-guard'
import { ensureFound } from '~/lib/ensure-found'

export const Route = createFileRoute('/_shell/reklamacije/emotive/$id')({
  beforeLoad: internalRequireEmotiveClaimsView(),
  validateSearch: (search) => ClaimDetailSearchSchema.parse(search),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    // Only the claim aggregate is on the view's critical path. Edit-form
    // catalogs load when the edit form mounts — prefetching them here fired
    // 6 concurrent requests per claim open, starving the claim's own fetch.
    await ensureFound(queryClient.ensureQueryData(emotiveClaimDetailOptions(id)))
  },
  staticData: { crumb: m.crumb_detail },
  component: EmotiveClaimDetailPage,
  pendingComponent: EmotiveClaimDetailPending,
  errorComponent: EmotiveClaimDetailError,
  notFoundComponent: EmotiveClaimDetailNotFound,
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
  const { tab, categoryCode } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="flex w-full max-w-[1360px] flex-col gap-6">
      <Suspense fallback={<EmotiveClaimDetailSkeleton />}>
        <EmotiveClaimDetailView
          id={id}
          tab={tab}
          categoryCode={categoryCode}
          onTabChange={(nextTab) => {
            void navigate({ search: (prev) => ({ ...prev, tab: nextTab }) })
          }}
        />
      </Suspense>
    </div>
  )
}

function EmotiveClaimDetailPending(): React.ReactElement {
  return (
    <div className="flex w-full max-w-[1360px] flex-col gap-6">
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

function EmotiveClaimDetailError(): React.ReactElement {
  // Not the `reset` the router offers an errorComponent: it clears the catch boundary, the errored
  // match re-throws, and no request goes out. `invalidate()` is what re-runs the loader.
  const router = useRouter()

  return (
    <div className="flex w-full max-w-[1360px] flex-col gap-6">
      <BackLink />
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">{m.emotive_claims_error_title()}</p>
        <p className="mt-1 text-sm text-muted-foreground">{m.emotive_claims_error_description()}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => {
            void router.invalidate()
          }}
        >
          {m.emotive_claims_error_retry()}
        </Button>
      </div>
    </div>
  )
}

/**
 * A claim that is not there is a NOT-FOUND, and the loader now says so (`ensureFound`). Deciding it
 * from the error's status could not work on a hard load: SSR hands the client a plain `Error` with no
 * own properties, so a pasted link showed "could not be loaded" and a retry that can never succeed.
 */
function EmotiveClaimDetailNotFound(): React.ReactElement {
  return (
    <div className="flex w-full max-w-[1360px] flex-col gap-6">
      <BackLink />
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">
          {m.emotive_claims_detail_not_found_title()}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {m.emotive_claims_detail_not_found_description()}
        </p>
      </div>
    </div>
  )
}
