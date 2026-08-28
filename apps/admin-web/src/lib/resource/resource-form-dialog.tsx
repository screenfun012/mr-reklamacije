import { m } from '@mr/i18n'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@mr/ui'
import { useEffect, useState } from 'react'
import { Suspense } from 'react'

import {
  admDialogClassName,
  admFieldClassName,
  admLabelClassName,
  admLockedFieldClassName,
  admPrimaryButtonClassName,
  admSecondaryButtonClassName,
} from '../adm-chrome.js'
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
      <DialogContent className={`${admDialogClassName} max-w-[520px]`}>
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
                  <span className={admLabelClassName}>{field.label()}</span>
                  <p className={admLockedFieldClassName}>
                    {value}
                    <span className="ml-auto font-mono text-[8.5px] font-bold uppercase tracking-[0.14em]">
                      {m.admin_catalog_field_locked()}
                    </span>
                  </p>
                  {field.hint ? (
                    <p className="text-xs text-muted-foreground">{field.hint()}</p>
                  ) : null}
                </div>
              )
            }

            if (field.type === 'reference-select') {
              return (
                <Suspense
                  key={field.key}
                  fallback={
                    <div className="space-y-1.5">
                      <span className={admLabelClassName}>{field.label()}</span>
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

            if (field.type === 'select') {
              return (
                <div key={field.key} className="space-y-1.5">
                  <label className={admLabelClassName} htmlFor={fieldId}>
                    {field.label()}
                  </label>
                  <select
                    id={fieldId}
                    value={value}
                    aria-label={field.label()}
                    disabled={isPending}
                    className={`${admFieldClassName} cursor-pointer`}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                  >
                    {field.options().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            }

            if (field.type === 'textarea') {
              return (
                <div key={field.key} className="space-y-1.5">
                  <label className={admLabelClassName} htmlFor={fieldId}>
                    {field.label()}
                  </label>
                  <textarea
                    id={fieldId}
                    className={`${admFieldClassName} min-h-24 py-2.5`}
                    value={value}
                    disabled={isPending}
                    onChange={(event) => setFieldValue(field.key, event.target.value)}
                  />
                </div>
              )
            }

            return (
              <div key={field.key} className="space-y-1.5">
                <label className={admLabelClassName} htmlFor={fieldId}>
                  {field.label()}
                </label>
                <input
                  id={fieldId}
                  className={admFieldClassName}
                  value={value}
                  type={field.type === 'number' ? 'number' : undefined}
                  step={field.type === 'number' ? 1 : undefined}
                  inputMode={field.type === 'number' ? 'numeric' : undefined}
                  disabled={isPending}
                  onChange={(event) => setFieldValue(field.key, event.target.value)}
                />
                {field.hint ? (
                  <p className="text-xs text-muted-foreground">{field.hint()}</p>
                ) : null}
              </div>
            )
          })}
        </div>

        <DialogFooter className="gap-2.5 sm:justify-stretch">
          <button
            type="button"
            className={admSecondaryButtonClassName}
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {m.action_cancel()}
          </button>
          <button
            type="button"
            className={admPrimaryButtonClassName}
            disabled={isPending || isSubmitDisabled(definition, mode, values)}
            onClick={handleSubmit}
          >
            {m.action_save()}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
