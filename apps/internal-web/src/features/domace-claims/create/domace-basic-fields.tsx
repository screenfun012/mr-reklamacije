import { formatFieldError } from '@mr/shared'
import type { EngineManufacturerListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { DatePicker, Input, SearchableSelect } from '@mr/ui'

import { EngineTypeSearchableSelectField } from '../../claims/engine-type-searchable-select-field.js'
import type { EngineTypeOrphanOption } from '../../claims/engine-type-options.js'
import { TEXTAREA_FIELD_CLASS } from '../../emotive-claims/create/form-field-styles.js'
import type { DomaceClaimFormValues } from './domace-claim-create-schemas.js'

interface DomaceBasicFieldsProps {
  form: {
    Field: React.ComponentType<{
      name: keyof DomaceClaimFormValues
      children: (field: {
        state: { value: string; meta: { errors: unknown[] } }
        handleChange: (value: string) => void
        handleBlur: () => void
      }) => React.ReactNode
    }>
    Subscribe: React.ComponentType<{
      selector: (state: { values: DomaceClaimFormValues }) => string
      children: (manufacturerId: string) => React.ReactNode
    }>
    setFieldValue: (name: 'engineTypeId', value: string) => void
  }
  manufacturers: EngineManufacturerListItem[]
  orphanEngineType?: EngineTypeOrphanOption | undefined
  stepErrors: Record<string, string>
  disabled: boolean
}

export function DomaceBasicFields({
  form,
  manufacturers,
  orphanEngineType,
  stepErrors,
  disabled,
}: DomaceBasicFieldsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <form.Field
        name="mrNumber"
        children={(field) => (
          <FieldGroup
            id="mrNumber"
            label={m.domace_claims_create_field_mr_number()}
            error={stepErrors['mrNumber'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <Input
              id="mrNumber"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </FieldGroup>
        )}
      />

      <form.Field
        name="claimNumber"
        children={(field) => (
          <FieldGroup id="claimNumber" label={m.domace_claims_create_field_claim_number()}>
            <Input
              id="claimNumber"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </FieldGroup>
        )}
      />

      <form.Field
        name="customerName"
        children={(field) => (
          <FieldGroup
            id="customerName"
            label={m.domace_claims_create_field_customer_name()}
            error={stepErrors['customerName']}
          >
            <Input
              id="customerName"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </FieldGroup>
        )}
      />

      <form.Field
        name="manufacturerId"
        children={(field) => (
          <FieldGroup
            id="manufacturerId"
            label={m.emotive_claims_create_field_manufacturer()}
            error={stepErrors['manufacturerId']}
          >
            <SearchableSelect
              id="manufacturerId"
              value={field.state.value}
              options={manufacturers.map((manufacturer) => ({
                value: manufacturer.id,
                label: manufacturer.name,
                keywords: manufacturer.code,
              }))}
              placeholder={m.emotive_claims_create_select_placeholder()}
              searchPlaceholder={m.field_search_placeholder()}
              emptyOptionLabel={m.emotive_claims_create_select_placeholder()}
              noResultsLabel={m.field_no_results()}
              disabled={disabled}
              aria-label={m.emotive_claims_create_field_manufacturer()}
              onValueChange={(nextValue) => {
                field.handleChange(nextValue)
                form.setFieldValue('engineTypeId', '')
              }}
              onBlur={field.handleBlur}
            />
          </FieldGroup>
        )}
      />

      <form.Subscribe selector={(state) => state.values.manufacturerId}>
        {(manufacturerId) => (
          <form.Field
            name="engineTypeId"
            children={(field) => (
              <FieldGroup id="engineTypeId" label={m.domace_claims_create_field_engine_type()}>
                <EngineTypeSearchableSelectField
                  id="engineTypeId"
                  value={field.state.value}
                  manufacturerId={manufacturerId}
                  orphanEngineType={orphanEngineType}
                  disabled={disabled}
                  aria-label={m.domace_claims_create_field_engine_type()}
                  onValueChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              </FieldGroup>
            )}
          />
        )}
      </form.Subscribe>

      <form.Field
        name="engineCode"
        children={(field) => (
          <FieldGroup id="engineCode" label={m.domace_claims_create_field_engine_code()}>
            <Input
              id="engineCode"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </FieldGroup>
        )}
      />

      <form.Field
        name="dateOfFinish"
        children={(field) => (
          <FieldGroup
            id="dateOfFinish"
            label={m.domace_claims_create_field_date_finish()}
            error={stepErrors['dateOfFinish'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <DatePicker
              id="dateOfFinish"
              value={field.state.value.length > 0 ? field.state.value : undefined}
              onChange={(value) => {
                field.handleChange(value ?? '')
              }}
              disabled={disabled}
              aria-label={m.domace_claims_create_field_date_finish()}
            />
          </FieldGroup>
        )}
      />

      <form.Field
        name="dateOfClaim"
        children={(field) => (
          <FieldGroup
            id="dateOfClaim"
            label={m.domace_claims_create_field_date_claim()}
            error={stepErrors['dateOfClaim'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <DatePicker
              id="dateOfClaim"
              value={field.state.value.length > 0 ? field.state.value : undefined}
              onChange={(value) => {
                field.handleChange(value ?? '')
              }}
              disabled={disabled}
              aria-label={m.domace_claims_create_field_date_claim()}
            />
          </FieldGroup>
        )}
      />

      <form.Field
        name="warrantyReport"
        children={(field) => (
          <FieldGroup id="warrantyReport" label={m.domace_claims_create_field_warranty_report()}>
            <textarea
              id="warrantyReport"
              className={TEXTAREA_FIELD_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </FieldGroup>
        )}
      />
    </div>
  )
}

interface FieldGroupProps {
  id: string
  label: string
  error?: string | undefined
  children: React.ReactNode
}

function FieldGroup({ id, label, error, children }: FieldGroupProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </div>
  )
}
