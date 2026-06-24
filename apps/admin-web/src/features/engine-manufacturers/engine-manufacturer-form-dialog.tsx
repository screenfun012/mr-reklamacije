import { m } from '@mr/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from '@mr/ui'
import { useEffect, useState } from 'react'

import {
  engineManufacturerSaveErrorMessage,
  useCreateEngineManufacturer,
  useUpdateEngineManufacturer,
} from './use-engine-manufacturer-mutations.js'

export interface EngineManufacturerFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues?: {
    code: string
    name: string
    sortOrder: string
  }
  manufacturerId?: string
  onOpenChange: (open: boolean) => void
}

export function EngineManufacturerFormDialog({
  open,
  mode,
  initialValues,
  manufacturerId,
  onOpenChange,
}: EngineManufacturerFormDialogProps): React.ReactElement {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('')

  const createMutation = useCreateEngineManufacturer()
  const updateMutation = useUpdateEngineManufacturer(manufacturerId ?? '')

  const isPending = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (!open) {
      return
    }
    setCode(initialValues?.code ?? '')
    setName(initialValues?.name ?? '')
    setSortOrder(initialValues?.sortOrder ?? '')
  }, [initialValues?.code, initialValues?.name, initialValues?.sortOrder, open])

  const handleSubmit = (): void => {
    void (async () => {
      try {
        if (mode === 'create') {
          const parsedSortOrder =
            sortOrder.trim() === '' ? undefined : Number.parseInt(sortOrder, 10)
          await createMutation.mutateAsync({
            code: code.trim(),
            name: name.trim(),
            sortOrder: Number.isNaN(parsedSortOrder) ? undefined : parsedSortOrder,
          })
          toast.success(m.admin_engine_manufacturers_create_success())
        } else if (manufacturerId !== undefined) {
          const parsedSortOrder =
            sortOrder.trim() === '' ? undefined : Number.parseInt(sortOrder, 10)
          await updateMutation.mutateAsync({
            name: name.trim(),
            sortOrder: Number.isNaN(parsedSortOrder) ? undefined : parsedSortOrder,
          })
          toast.success(m.admin_engine_manufacturers_update_success())
        }
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
          <DialogTitle>
            {mode === 'create'
              ? m.admin_engine_manufacturers_create_title()
              : m.admin_engine_manufacturers_edit_title()}
          </DialogTitle>
          <DialogDescription>{m.admin_engine_manufacturers_subtitle()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'create' ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="manufacturer-code">
                {m.field_code()}
              </label>
              <Input
                id="manufacturer-code"
                value={code}
                disabled={isPending}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="text-sm font-medium">{m.field_code()}</span>
              <p className="text-sm text-muted-foreground">{code}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="manufacturer-name">
              {m.field_name()}
            </label>
            <Input
              id="manufacturer-name"
              value={name}
              disabled={isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="manufacturer-sort-order">
              {m.field_sort_order()}
            </label>
            <Input
              id="manufacturer-sort-order"
              inputMode="numeric"
              value={sortOrder}
              disabled={isPending}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button
            type="button"
            disabled={isPending || name.trim() === '' || (mode === 'create' && code.trim() === '')}
            onClick={handleSubmit}
          >
            {m.action_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
