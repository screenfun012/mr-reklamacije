import { m } from '@mr/i18n'
import {
  claimCategoriesReferenceOptions,
  claimCategoryFieldsForCategoryOptions,
  type ClaimCategoryListItem,
  type ClaimCategoryRef,
  type ClaimKind as ClaimKindValue,
} from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { CategoryChipMenu } from './category-chip-menu'
import { useChangeClaimCategory } from './use-change-claim-category'

export interface CategoryChangeControlProps {
  kind: ClaimKindValue
  claimId: string
  category: ClaimCategoryRef | null
  /** Whoever may edit the claim may correct its kind of work — no permission of its own. */
  canEdit: boolean
}

/**
 * The category beside the MR number, and the way to correct it (handoff „promena kategorije").
 *
 * A worker enters a claim as an overhaul when it was machining. The chip opens the same menu the
 * wizard uses; picking another kind of work goes through a confirmation that names both, because
 * it changes which questions the claim answers — the old answers are KEPT (they show as
 * "Prethodna kategorija") and the new ones start empty, with the claim marked until they are
 * filled in. Nothing is deleted, so the confirm is not destructive-red.
 */
export function CategoryChangeControl({
  kind,
  claimId,
  category,
  canEdit,
}: CategoryChangeControlProps): React.ReactElement | null {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<ClaimCategoryListItem | null>(null)
  const changeCategory = useChangeClaimCategory(kind, claimId)

  const { data: categories } = useQuery({
    ...claimCategoriesReferenceOptions({ activeOnly: true }),
    enabled: canEdit,
  })

  if (category === null) {
    return null
  }

  // A claim that predates the catalogue, or one whose category the office has since switched off,
  // still has to name what it carries — the menu simply has no entry to switch back to.
  const options: ClaimCategoryListItem[] = (categories ?? []).some(
    (item) => item.id === category.id,
  )
    ? (categories ?? [])
    : [
        {
          id: category.id,
          code: category.code,
          name: category.name,
          sortOrder: -1,
          isActive: category.isActive,
          deactivatedAt: null,
          usageCount: 0,
        },
        ...(categories ?? []),
      ]

  async function confirmChange(): Promise<void> {
    if (pending === null) {
      return
    }
    const from = category?.name ?? ''
    const to = pending.name
    await changeCategory.mutateAsync(pending.id)
    setPending(null)
    showInternalToast(m.claim_category_change_success({ from, to }))
    // The answers of the category just left have to be readable at once, and the ones it moved
    // into have to be asked for — both come from the fields catalogue, per category.
    void queryClient.invalidateQueries({ queryKey: ['claim-category-fields'] })
  }

  return (
    <>
      <CategoryChipMenu
        categories={options}
        categoryId={category.id}
        categoryName={category.name}
        onPick={setPending}
        disabled={!canEdit || changeCategory.isPending}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null)
          }
        }}
        title={m.claim_category_change_title()}
        description={
          <span className="flex flex-col gap-2.5">
            <span>
              {m.claim_category_change_description({
                from: category.name,
                to: pending?.name ?? '',
              })}
            </span>
            {pending === null ? null : <RequiredFieldsNote categoryId={pending.id} />}
          </span>
        }
        confirmLabel={m.claim_category_change_confirm()}
        // Nothing is deleted — the old answers are kept and shown as "Prethodna kategorija" —
        // so this is a decision, not a destructive act, and must not read as red. `variant`
        // cannot say that here: the brand PRIMARY is the same red as `destructive`.
        variant="default"
        confirmClassName="border-none bg-mri-btn text-mri-btnfg hover:bg-mri-btnhv"
        pending={changeCategory.isPending}
        onConfirm={() => void confirmChange()}
      />
    </>
  )
}

/** Says so up front when the kind of work being moved into asks for something. */
function RequiredFieldsNote({ categoryId }: { categoryId: string }): React.ReactElement | null {
  const { data: fields } = useQuery(claimCategoryFieldsForCategoryOptions(categoryId))
  const hasRequired = (fields ?? []).some((field) => field.isActive && field.isRequired)

  if (!hasRequired) {
    return null
  }

  return (
    <span className="rounded-lg border border-dashed border-[rgba(234,179,8,.4)] bg-[rgba(234,179,8,.07)] px-3 py-2 text-[12px] text-mri-amb">
      {m.claim_category_change_required_note()}
    </span>
  )
}
