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

import {
  engineManufacturerSaveErrorMessage,
  useDeactivateEngineManufacturer,
} from './use-engine-manufacturer-mutations.js'

export interface EngineManufacturerDeactivateDialogProps {
  open: boolean
  manufacturerId: string
  manufacturerName: string
  onOpenChange: (open: boolean) => void
}

export function EngineManufacturerDeactivateDialog({
  open,
  manufacturerId,
  manufacturerName,
  onOpenChange,
}: EngineManufacturerDeactivateDialogProps): React.ReactElement {
  const deactivateMutation = useDeactivateEngineManufacturer(manufacturerId)

  const handleConfirm = (): void => {
    void (async () => {
      try {
        await deactivateMutation.mutateAsync()
        toast.success(m.admin_engine_manufacturers_deactivate_success())
        onOpenChange(false)
      } catch (error) {
        toast.error(engineManufacturerSaveErrorMessage(error))
      }
    })()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{m.admin_engine_manufacturers_deactivate_title()}</DialogTitle>
          <DialogDescription>
            {m.admin_engine_manufacturers_deactivate_description({ name: manufacturerName })}
          </DialogDescription>
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
            {m.admin_engine_manufacturers_deactivate_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
