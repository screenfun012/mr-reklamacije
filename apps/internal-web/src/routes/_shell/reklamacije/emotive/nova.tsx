import { Suspense } from 'react'

import { prefetchClaimEditReferences } from '@mr/shared'
import { m } from '@mr/i18n'
import { Heading, Skeleton } from '@mr/ui'
import { createFileRoute, Link } from '@tanstack/react-router'

import { EmotiveClaimCreateWizard } from '~/features/emotive-claims/create/emotive-claim-create-wizard'
import { internalRequireEmotiveClaimsCreate } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/reklamacije/emotive/nova')({
  beforeLoad: internalRequireEmotiveClaimsCreate(),
  loader: async ({ context: { queryClient } }) => {
    await prefetchClaimEditReferences(queryClient)
  },
  component: EmotiveClaimNovaPage,
  pendingComponent: EmotiveClaimNovaPending,
})

function EmotiveClaimNovaPage(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          to="/reklamacije"
          search={{ page: 1, pageSize: 10 }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {m.emotive_claims_create_back_to_list()}
        </Link>
        <Heading level="h1" className="mt-2">
          {m.emotive_claims_new_claim()}
        </Heading>
      </div>
      <Suspense fallback={<EmotiveClaimCreateSkeleton />}>
        <EmotiveClaimCreateWizard />
      </Suspense>
    </div>
  )
}

function EmotiveClaimNovaPending(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <EmotiveClaimCreateSkeleton />
    </div>
  )
}

function EmotiveClaimCreateSkeleton(): React.ReactElement {
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
