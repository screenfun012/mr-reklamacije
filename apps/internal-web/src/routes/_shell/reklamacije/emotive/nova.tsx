import { Suspense } from 'react'

import { prefetchClaimEditReferences } from '@mr/shared'
import { m } from '@mr/i18n'
import { Skeleton } from '@mr/ui'
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
    <div className="mx-auto flex w-full max-w-[860px] flex-col">
      <div className="mb-[30px]">
        <Link
          to="/reklamacije"
          search={{ page: 1, pageSize: 10 }}
          className="mri-fade-up mb-[18px] inline-block text-sm font-semibold text-mri-text2 transition-colors hover:text-mri-redh"
        >
          {m.emotive_claims_create_back_to_list()}
        </Link>
        <h1
          className="mri-fade-up text-[32px] font-extrabold tracking-[-0.02em] text-mri-text"
          style={{ animationDelay: '0.05s' }}
        >
          {m.emotive_claims_new_claim()}
        </h1>
      </div>
      <Suspense fallback={<EmotiveClaimCreateSkeleton />}>
        <EmotiveClaimCreateWizard />
      </Suspense>
    </div>
  )
}

function EmotiveClaimNovaPending(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <EmotiveClaimCreateSkeleton />
    </div>
  )
}

function EmotiveClaimCreateSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-mri-border bg-mri-surface p-6">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-1/3 self-end" />
    </div>
  )
}
