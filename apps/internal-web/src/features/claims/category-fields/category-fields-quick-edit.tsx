import { m } from '@mr/i18n'
import { ClaimKind, type ClaimCategoryFieldValues } from '@mr/shared'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mr/ui'
import { useState } from 'react'

import { CategoryFieldsGroup } from './category-fields-group'
import { useSaveCategoryFieldValues } from './use-save-category-field-values'

export interface CategoryFieldsQuickEditProps {
  claimId: string
  kind: ClaimKind
  categoryId: string
  categoryName: string
  values: ClaimCategoryFieldValues
}

/**
 * „Nije upisano šta je otkazalo" — the band that keeps the cause from staying empty forever.
 *
 * The cause is not known when a claim is opened; it is known when somebody takes the engine
 * apart. If the only way in were the full "IZMENI PODATKE" form, the field would stay empty and
 * the statistics would keep saying "Nije upisano" a year from now — which is the one way this
 * whole feature fails.
 */
export function CategoryFieldsQuickEdit({
  claimId,
  kind,
  categoryId,
  categoryName,
  values,
}: CategoryFieldsQuickEditProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ClaimCategoryFieldValues>(values)
  const save = useSaveCategoryFieldValues(kind, claimId)

  function handleOpenChange(next: boolean): void {
    if (next) {
      setDraft(values)
    }
    setOpen(next)
  }

  return (
    <>
      <div
        data-testid="category-fields-missing-band"
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-[rgba(234,179,8,.4)] bg-mri-warn-bg px-3 py-2"
      >
        <span className="text-[12px] font-semibold text-mri-warn">
          ⚠ {m.claim_detail_cause_missing()}
        </span>
        <Button type="button" size="sm" onClick={() => handleOpenChange(true)}>
          {m.claim_detail_cause_fill()}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.claim_detail_cause_dialog_title()}</DialogTitle>
            <DialogDescription>{m.claim_detail_cause_dialog_description()}</DialogDescription>
          </DialogHeader>

          <CategoryFieldsGroup
            categoryId={categoryId}
            categoryName={categoryName}
            values={draft}
            onChange={setDraft}
            disabled={save.isPending}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={save.isPending}
            >
              {m.action_cancel()}
            </Button>
            <Button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(draft, { onSuccess: () => setOpen(false) })}
            >
              {m.action_save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
