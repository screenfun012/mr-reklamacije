import { ConfirmDialog, toast } from '@mr/ui'

import type { ResourceDefinition } from './types.js'
import { createResourceCrudHooks, resourceSaveErrorMessage } from './use-resource-crud.js'

export interface ResourceHardDeleteDialogProps<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  definition: ResourceDefinition<TItem, TCreate, TUpdate>
  item: TItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResourceHardDeleteDialog<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>({
  definition,
  item,
  open,
  onOpenChange,
}: ResourceHardDeleteDialogProps<TItem, TCreate, TUpdate>): React.ReactElement {
  const lifecycle = definition.lifecycle
  const { useHardDeleteResource } = createResourceCrudHooks(definition)
  const hardDeleteMutation = useHardDeleteResource(item.id)

  if (!lifecycle) {
    return <></>
  }

  const handleConfirm = (): void => {
    void (async () => {
      try {
        await hardDeleteMutation.mutateAsync()
        toast.success(lifecycle.hardDeleteSuccessMessage())
        onOpenChange(false)
      } catch (error) {
        toast.error(resourceSaveErrorMessage(error, definition.subtitle()))
      }
    })()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={lifecycle.hardDeleteTitle()}
      description={lifecycle.hardDeleteDescription(item)}
      confirmLabel={lifecycle.hardDeleteConfirmLabel()}
      pending={hardDeleteMutation.isPending}
      onConfirm={handleConfirm}
    />
  )
}
