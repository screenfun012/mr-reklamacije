import { ConfirmDialog, toast } from '@mr/ui'

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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant={isDeactivating ? 'destructive' : 'default'}
      pending={setActiveMutation.isPending}
      onConfirm={handleConfirm}
    />
  )
}
