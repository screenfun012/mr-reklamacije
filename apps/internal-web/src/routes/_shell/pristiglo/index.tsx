import { pendingClientSubmissionsListOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading } from '@mr/ui'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import { InboxList } from '~/features/inbox/inbox-list'
import { InboxListSkeleton } from '~/features/inbox/inbox-list-skeleton'

const InboxSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_shell/pristiglo/')({
  validateSearch: (search) => InboxSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context: { queryClient }, deps: { page } }) => {
    await queryClient.ensureQueryData(pendingClientSubmissionsListOptions(page))
  },
  component: PristigloListPage,
  pendingComponent: PristigloListPending,
  errorComponent: PristigloListError,
})

function InboxHeader(): React.ReactElement {
  return (
    <div>
      <Heading level="h1">{m.nav_pristiglo()}</Heading>
      <p className="mt-1 text-sm text-mri-text2">{m.internal_pristiglo_subtitle()}</p>
    </div>
  )
}

function PristigloListPage(): React.ReactElement {
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="flex flex-col gap-6">
      <InboxHeader />
      <InboxList
        page={page}
        onPageChange={(next) => {
          void navigate({ search: { page: next }, replace: true })
        }}
      />
    </div>
  )
}

function PristigloListPending(): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <InboxHeader />
      <InboxListSkeleton />
    </div>
  )
}

function PristigloListError(): React.ReactElement {
  // Not the `reset` the router offers an errorComponent: it clears the catch boundary, the errored
  // match re-throws, and no request goes out. `invalidate()` is what re-runs the loader.
  const router = useRouter()

  return (
    <div className="flex flex-col gap-6">
      <InboxHeader />
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">{m.internal_inbox_error_title()}</p>
        <p className="mt-1 text-sm text-muted-foreground">{m.internal_inbox_error_description()}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => {
            void router.invalidate()
          }}
        >
          {m.internal_inbox_error_retry()}
        </Button>
      </div>
    </div>
  )
}
