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
import { Suspense } from 'react'

import { ResourceReferenceSelectField } from './resource-reference-select-field.js'
import type { ResourceDefinition, ResourceFormFieldDef } from './types.js'
import { createResourceCrudHooks, resourceSaveErrorMessage } from './use-resource-crud.js'

export interface ResourceFormDialogProps<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  definition: ResourceDefinition<TItem, TCreate, TUpdate>
  open: boolean
  mode: 'create' | 'edit'
  item?: TItem
  onOpenChange: (open: boolean) => void
}

function visibleFields(
  fields: ResourceFormFieldDef[],
  mode: 'create' | 'edit',
): ResourceFormFieldDef[] {
  return fields.filter((field) => {
    if (mode === 'create' && field.editOnly === true) {
      return false
    }
    if (mode === 'edit' && field.createOnly === true) {
      return false
    }
    return true
  })
}

function isSubmitDisabled<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>(
  definition: ResourceDefinition<TItem, TCreate, TUpdate>,
  mode: 'create' | 'edit',
  values: Record<string, string>,
): boolean {
  return visibleFields(definition.formFields, mode).some((field) => {
    if (field.type === 'readonly' || field.required !== true) {
      return false
    }
    return values[field.key]?.trim() === ''
  })
}

function isReadonlyField(field: ResourceFormFieldDef, mode: 'create' | 'edit'): boolean {
  return field.type === 'readonly' || (field.createOnly === true && mode === 'edit')
}

export function ResourceFormDialog<
  TItem extends { id: string; isActive: boolean },
  TCreate extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
>({
  definition,
  open,
  mode,
  item,
  onOpenChange,
}: ResourceFormDialogProps<TItem, TCreate, TUpdate>): React.ReactElement {
  const [values, setValues] = useState<Record<string, string>>({})
  const crud = createResourceCrudHooks(definition)
  const createMutation = crud.useCreateResource()
  const updateMutation = crud.useUpdateResource(item?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (!open) {
      return
    }
    setValues(definition.getInitialFormValues(item))
  }, [definition, item, open])

  const setFieldValue = (key: string, value: string): void => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (): void => {
    void (async () => {
      try {
        if (mode === 'create') {
          await createMutation.mutateAsync(definition.buildCreateBody(values))
          toast.success(definition.createSuccessMessage())
        } else if (item !== undefined) {
          await updateMutation.mutateAsync(definition.buildUpdateBody(values))
          toast.success(definition.updateSuccessMessage())
        }
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
          <DialogTitle>
            {mode === 'create' ? definition.createTitle() : definition.editTitle()}
          </DialogTitle>
          <DialogDescription>{definition.subtitle()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {visibleFields(definition.formFields, mode).map((field) => {
            const fieldId = `resource-field-${field.key}`
            const value = values[field.key] ?? ''

            if (isReadonlyField(field, mode)) {
              return (
                <div key={field.key} className="space-y-1.5">
                  <span className="text-sm font-medium">{field.label()}</span>
                  <p className="text-sm text-muted-foreground">{value}</p>
                </div>
              )
            }

            if (field.type === 'reference-select') {
              return (
                <Suspense
                  key={field.key}
                  fallback={
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium">{field.label()}</span>
                      <p className="text-sm text-muted-foreground">…</p>
                    </div>
                  }
                >
                  <ResourceReferenceSelectField
                    field={field}
                    fieldId={fieldId}
                    value={value}
                    disabled={isPending}
                    onChange={(next) => setFieldValue(field.key, next)}
                  />
                </Suspense>
              )
            }

            if (field.type === 'textarea') {
              return (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor={fieldId}>
                    {field.label()}
                  </label>
                  <textarea
                    id={fieldId}
                    className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    value={value}
                    disabled={isPending}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                  />
                </div>
              )
            }

            return (
              <div key={field.key} className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor={fieldId}>
                  {field.label()}
                </label>
                <Input
                  id={fieldId}
                  value={value}
                  inputMode={field.type === 'number' ? 'numeric' : undefined}
                  disabled={isPending}
                  onChange={(event) => setFieldValue(field.key, event.target.value)}
                />
              </div>
            )
          })}
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
            disabled={isPending || isSubmitDisabled(definition, mode, values)}
            onClick={handleSubmit}
          >
            {m.action_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
