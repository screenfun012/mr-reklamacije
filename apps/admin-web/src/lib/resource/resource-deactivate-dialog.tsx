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

import { m } from '@mr/i18n'

import type { ResourceDefinition } from './types.js'
import { createResourceCrudHooks, resourceSaveErrorMessage } from './use-resource-crud.js'

export interface ResourceDeactivateDialogProps<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  definition: ResourceDefinition<TItem, TCreate, TUpdate>
  item: TItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResourceDeactivateDialog<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>({
  definition,
  item,
  open,
  onOpenChange,
}: ResourceDeactivateDialogProps<TItem, TCreate, TUpdate>): React.ReactElement {
  const { useDeactivateResource } = createResourceCrudHooks(definition)
  const deactivateMutation = useDeactivateResource(item.id)

  const handleConfirm = (): void => {
    void (async () => {
      try {
        await deactivateMutation.mutateAsync()
        toast.success(definition.deactivateSuccessMessage())
        onOpenChange(false)
      } catch (error) {
        toast.error(resourceSaveErrorMessage(error, definition.subtitle()))
      }
    })()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{definition.deactivateTitle()}</DialogTitle>
          <DialogDescription>{definition.deactivateDescription(item)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deactivateMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deactivateMutation.isPending}
            onClick={handleConfirm}
          >
            {definition.deactivateConfirmLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
