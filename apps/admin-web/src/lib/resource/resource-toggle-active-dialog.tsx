import { m } from '@mr/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@mr/ui'

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={setActiveMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button
            type="button"
            variant={isDeactivating ? 'destructive' : 'default'}
            disabled={setActiveMutation.isPending}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
