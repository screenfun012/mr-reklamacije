import { m } from '@mr/i18n'
import { toast } from '@mr/ui'

import { AdmConfirmDialog } from '~/components/adm-confirm-dialog'
import type { ResourceDefinition } from './types.js'
import { createResourceCrudHooks, resourceSaveErrorMessage } from './use-resource-crud.js'

export interface ResourceToggleActiveDialogProps<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  definition: ResourceDefinition<TItem, TCreate, TUpdate>
  item: TItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResourceToggleActiveDialog<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>({
  definition,
  item,
  open,
  onOpenChange,
}: ResourceToggleActiveDialogProps<TItem, TCreate, TUpdate>): React.ReactElement {
  const { useSetResourceActive } = createResourceCrudHooks(definition)
  const setActiveMutation = useSetResourceActive(item.id)
  const isDeactivating = item.isActive

  const handleConfirm = (): void => {
    void (async () => {
      try {
        await setActiveMutation.mutateAsync(!item.isActive)
        toast.success(
          isDeactivating
            ? definition.deactivateSuccessMessage()
            : (definition.lifecycle?.reactivateSuccessMessage() ??
                definition.updateSuccessMessage()),
        )
        onOpenChange(false)
      } catch (error) {
        toast.error(resourceSaveErrorMessage(error, definition.subtitle()))
      }
    })()
  }

  const title = isDeactivating
    ? definition.deactivateTitle()
    : (definition.lifecycle?.reactivateTitle() ?? definition.editTitle())

  const description = isDeactivating
    ? definition.deactivateDescription(item)
    : (definition.lifecycle?.reactivateDescription(item) ?? definition.subtitle())

  const confirmLabel = isDeactivating
    ? definition.deactivateConfirmLabel()
    : (definition.lifecycle?.reactivateConfirmLabel() ?? definition.editActionLabel())

  return (
    <AdmConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tag={isDeactivating ? m.admin_confirm_tag_deactivate() : m.admin_confirm_tag_activate()}
      // Switching a catalogue row off is reversible and takes nothing away from what exists — amber,
      // not red. The red confirm is reserved for the row that disappears.
      tone={isDeactivating ? 'warning' : 'neutral'}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      pending={setActiveMutation.isPending}
      onConfirm={handleConfirm}
    />
  )
}
