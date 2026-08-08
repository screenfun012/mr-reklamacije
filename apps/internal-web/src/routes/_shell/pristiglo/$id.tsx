import { clientSubmissionAttachmentsOptions, clientSubmissionDetailOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { Skeleton } from '@mr/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'

import { InboxDetailView } from '~/features/inbox/inbox-detail'
import { ensureFound } from '~/lib/ensure-found'

export const Route = createFileRoute('/_shell/pristiglo/$id')({
  loader: async ({ context: { queryClient }, params: { id } }) => {
    await ensureFound(
      Promise.all([
        queryClient.ensureQueryData(clientSubmissionDetailOptions(id)),
        queryClient.ensureQueryData(clientSubmissionAttachmentsOptions(id)),
      ]),
    )
  },
  component: PristigloDetailPage,
  pendingComponent: PristigloDetailPending,
  errorComponent: PristigloDetailError,
  notFoundComponent: PristigloDetailNotFound,
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

function InboxDetailBox({
  title,
  description,
}: {
  title: string
  description: string
}): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink />
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function PristigloDetailError(): React.ReactElement {
  return (
    <InboxDetailBox
      title={m.internal_inbox_error_title()}
      description={m.internal_inbox_error_description()}
    />
  )
}

/**
 * A submission that is not there is a NOT-FOUND, and the loader now says so (`ensureFound`).
 * Deciding it from the error's status could not work on a hard load: SSR hands the client a plain
 * `Error` with no own properties, so a pasted link read as a transport failure.
 */
function PristigloDetailNotFound(): React.ReactElement {
  return (
    <InboxDetailBox
      title={m.internal_inbox_not_found_title()}
      description={m.internal_inbox_not_found_description()}
    />
  )
}
