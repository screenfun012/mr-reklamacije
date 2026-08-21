import { m } from '@mr/i18n'
import {
  claimCategoriesReferenceOptions,
  prefetchClaimEditReferences,
  type ClaimCategoryListItem,
} from '@mr/shared'
import { Skeleton } from '@mr/ui'
import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { ClaimCreateWizard } from '~/features/claims/create/claim-create-wizard'
import { ClaimsRouteError } from '~/features/claims/claims-route-states'
import { internalRequireClaimsCreate } from '~/lib/auth-guard'

/** Which kind of work the claim is about — carried in from the menu entry or the list. */
const NewClaimSearchSchema = z.object({
  categoryCode: z.string().trim().min(1).optional(),
})

export const Route = createFileRoute('/_shell/reklamacije/nova')({
  beforeLoad: internalRequireClaimsCreate(),
  validateSearch: (search: z.input<typeof NewClaimSearchSchema> & SearchSchemaInput) =>
    NewClaimSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      prefetchClaimEditReferences(queryClient),
      queryClient.ensureQueryData(claimCategoriesReferenceOptions({ activeOnly: true })),
    ])
  },
  // The trail restarts here: INTERNO / NOVA REKLAMACIJA. A new claim is not "inside" the list.
  staticData: { crumb: m.crumb_new_claim, crumbResetsTrail: true },
  component: NovaReklamacijaPage,
  pendingComponent: NovaReklamacijaPending,
  errorComponent: ClaimsRouteError,
})

const rootRoute = getRouteApi('__root__')

/**
 * The category is decided BEFORE the wizard opens — it is where the person already was. Without
 * one in the URL the first live category stands in, so the screen always has a kind of work to
 * show and the chip is the way to correct it.
 */
function categoryFrom(
  categories: readonly ClaimCategoryListItem[],
  code: string | undefined,
): ClaimCategoryListItem | null {
  if (code !== undefined) {
    const named = categories.find((category) => category.code === code)
    if (named !== undefined) {
      return named
    }
  }
  return categories[0] ?? null
}

function NovaReklamacijaPage(): React.ReactElement {
  const { categoryCode } = Route.useSearch()
  const navigate = useNavigate()
  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  const { data: categories } = useSuspenseQuery(
    claimCategoriesReferenceOptions({ activeOnly: true }),
  )

  const category = categoryFrom(categories, categoryCode)
  if (category === null) {
    // The catalogue cannot be empty in practice — the migration seeds four — but a claim without
    // a kind of work is refused by the server, so saying so beats a form that cannot be saved.
    return (
      <div className="mx-auto w-full max-w-[820px] rounded-[14px] border border-dashed border-mri-border2 p-8 text-center text-[13px] text-mri-text2">
        {m.claims_create_no_category()}
      </div>
    )
  }

  return (
    <ClaimCreateWizard
      category={category}
      canCreateEmotive={permissions.includes('emotive_claims.create')}
      canCreateDomace={permissions.includes('domace_claims.create')}
      onLeave={() => void navigate({ to: '/reklamacije' })}
    />
  )
}

function NovaReklamacijaPending(): React.ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
