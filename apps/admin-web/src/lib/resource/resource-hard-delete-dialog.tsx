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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{lifecycle.hardDeleteTitle()}</DialogTitle>
          <DialogDescription>{lifecycle.hardDeleteDescription(item)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={hardDeleteMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={hardDeleteMutation.isPending}
            onClick={handleConfirm}
          >
            {lifecycle.hardDeleteConfirmLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
