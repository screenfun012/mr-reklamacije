import {
  ApiError,
  clientSubmissionAttachmentsOptions,
  clientSubmissionDetailOptions,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Skeleton } from '@mr/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'

import { InboxDetailView } from '~/features/inbox/inbox-detail'

export const Route = createFileRoute('/_shell/pristiglo/$id')({
  loader: async ({ context: { queryClient }, params: { id } }) => {
    await Promise.all([
      queryClient.ensureQueryData(clientSubmissionDetailOptions(id)),
      queryClient.ensureQueryData(clientSubmissionAttachmentsOptions(id)),
    ])
  },
  component: PristigloDetailPage,
  pendingComponent: PristigloDetailPending,
  errorComponent: PristigloDetailError,
})

function BackLink(): React.ReactElement {
  return (
    <Link
      to="/pristiglo"
      search={{ page: 1 }}
      className="text-sm text-mri-text2 transition-colors hover:text-mri-redh"
    >
      {m.internal_inbox_detail_back()}
    </Link>
  )
}

function PristigloDetailPage(): React.ReactElement {
  const { id } = Route.useParams()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink />
      <Suspense fallback={<DetailSkeleton />}>
        <InboxDetailView id={id} />
      </Suspense>
    </div>
  )
}

function PristigloDetailPending(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Skeleton className="h-5 w-40" />
      <DetailSkeleton />
    </div>
  )
}

function DetailSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-32 w-full rounded-[14px]" />
      <Skeleton className="h-40 w-full rounded-[14px]" />
      <Skeleton className="h-[46px] w-64" />
    </div>
  )
}

function PristigloDetailError({ error }: { error: Error }): React.ReactElement {
  const isNotFound = error instanceof ApiError && error.status === 404

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink />
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">
          {isNotFound ? m.internal_inbox_not_found_title() : m.internal_inbox_error_title()}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isNotFound
            ? m.internal_inbox_not_found_description()
            : m.internal_inbox_error_description()}
        </p>
      </div>
    </div>
  )
}
