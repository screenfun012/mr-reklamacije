import { formatFieldError } from '@mr/shared'
import type { CustomerListItem, EmployeeListItem, EngineManufacturerListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import {
  DatePicker,
  Input,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mr/ui'

import { InternalFieldGroup } from '~/components/internal-field-group'

import { EmployeeSelectField } from '../../claims/employee-select-field.js'
import { MrDuplicateWarning } from '../../claims/mr-duplicate-warning.js'
import { EngineTypeSearchableSelectField } from '../../claims/engine-type-searchable-select-field.js'
import type { EngineTypeOrphanOption } from '../../claims/engine-type-options.js'
import type { EmotiveClaimFormValues } from './emotive-claim-create-schemas.js'
import {
  FORM_CONTROL_CLASS,
  SELECT_EMPTY_SENTINEL,
  TEXTAREA_FIELD_CLASS,
} from './form-field-styles.js'

function manufacturerOptions(
  manufacturers: readonly EngineManufacturerListItem[],
): { value: string; label: string; keywords: string }[] {
  return manufacturers.map((manufacturer) => ({
    value: manufacturer.id,
    label: manufacturer.name,
    keywords: manufacturer.code,
  }))
}

interface StepBasicFieldsProps {
  form: {
    Field: React.ComponentType<{
      name: keyof EmotiveClaimFormValues
      children: (field: {
        state: { value: string; meta: { errors: unknown[] } }
        handleChange: (value: string) => void
        handleBlur: () => void
      }) => React.ReactNode
    }>
    Subscribe: React.ComponentType<{
      selector: (state: { values: EmotiveClaimFormValues }) => string
      children: (manufacturerId: string) => React.ReactNode
    }>
    setFieldValue: (name: 'engineTypeId', value: string) => void
  }
  customers: CustomerListItem[]
  employees: EmployeeListItem[]
  manufacturers: EngineManufacturerListItem[]
  orphanEngineType?: EngineTypeOrphanOption | undefined
  stepErrors: Record<string, string>
  disabled: boolean
  /** Create-only: detail edit reuses these fields, where the claim's own MR would false-positive. */
  checkMrDuplicate?: boolean
}

export function StepBasicFields({
  form,
  customers,
  employees,
  manufacturers,
  orphanEngineType,
  stepErrors,
  disabled,
  checkMrDuplicate = false,
}: StepBasicFieldsProps): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form.Field
        name="mrNumber"
        children={(field) => (
          <InternalFieldGroup
            id="mrNumber"
            label={m.emotive_claims_create_field_mr_number()}
            required
            error={stepErrors['mrNumber'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <Input
              id="mrNumber"
              className={FORM_CONTROL_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
            {checkMrDuplicate ? <MrDuplicateWarning mrNumber={field.state.value} /> : null}
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="claimNumber"
        children={(field) => (
          <InternalFieldGroup id="claimNumber" label={m.emotive_claims_create_field_claim_number()}>
            <Input
              id="claimNumber"
              className={FORM_CONTROL_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="customerId"
        children={(field) => (
          <InternalFieldGroup
            id="customerId"
            label={m.emotive_claims_create_field_customer()}
            required
            error={stepErrors['customerId'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <Select
              value={field.state.value.length > 0 ? field.state.value : SELECT_EMPTY_SENTINEL}
              onValueChange={(value) => {
                field.handleChange(value === SELECT_EMPTY_SENTINEL ? '' : value)
              }}
              disabled={disabled}
            >
              <SelectTrigger
                id="customerId"
                className={FORM_CONTROL_CLASS}
                aria-label={m.emotive_claims_create_field_customer()}
                onBlur={field.handleBlur}
              >
                <SelectValue placeholder={m.emotive_claims_create_select_placeholder()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_EMPTY_SENTINEL}>
                  {m.emotive_claims_create_select_placeholder()}
                </SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="manufacturerId"
        children={(field) => (
          <InternalFieldGroup
            id="manufacturerId"
            label={m.emotive_claims_create_field_manufacturer()}
            error={stepErrors['manufacturerId'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <SearchableSelect
              id="manufacturerId"
              className={FORM_CONTROL_CLASS}
              value={field.state.value}
              options={manufacturerOptions(manufacturers)}
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
          </InternalFieldGroup>
        )}
      />

      <form.Subscribe selector={(state) => state.values.manufacturerId}>
        {(manufacturerId) => (
          <form.Field
            name="engineTypeId"
            children={(field) => (
              <InternalFieldGroup
                id="engineTypeId"
                label={m.emotive_claims_create_field_engine_type()}
                required
                error={stepErrors['engineTypeId'] ?? formatFieldError(field.state.meta.errors[0])}
              >
                <EngineTypeSearchableSelectField
                  id="engineTypeId"
                  className={FORM_CONTROL_CLASS}
                  value={field.state.value}
                  manufacturerId={manufacturerId}
                  orphanEngineType={orphanEngineType}
                  disabled={disabled}
                  aria-label={m.emotive_claims_create_field_engine_type()}
                  onValueChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              </InternalFieldGroup>
            )}
          />
        )}
      </form.Subscribe>

      <form.Field
        name="engineCode"
        children={(field) => (
          <InternalFieldGroup id="engineCode" label={m.emotive_claims_create_field_engine_code()}>
            <Input
              id="engineCode"
              className={FORM_CONTROL_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="employeeId"
        children={(field) => (
          <InternalFieldGroup id="employeeId" label={m.claims_field_assigned_worker()}>
            <EmployeeSelectField
              id="employeeId"
              value={field.state.value}
              employees={employees}
              disabled={disabled}
              aria-label={m.claims_field_assigned_worker()}
              onValueChange={field.handleChange}
              onBlur={field.handleBlur}
            />
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="dateOfFinish"
        children={(field) => (
          <InternalFieldGroup
            id="dateOfFinish"
            label={m.emotive_claims_create_field_date_finish()}
            error={stepErrors['dateOfFinish'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <DatePicker
              id="dateOfFinish"
              className={FORM_CONTROL_CLASS}
              value={field.state.value.length > 0 ? field.state.value : undefined}
              onChange={(value) => {
                field.handleChange(value ?? '')
              }}
              disabled={disabled}
              aria-label={m.emotive_claims_create_field_date_finish()}
            />
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="dateOfClaim"
        children={(field) => (
          <InternalFieldGroup
            id="dateOfClaim"
            label={m.emotive_claims_create_field_date_claim()}
            required
            error={stepErrors['dateOfClaim'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <DatePicker
              id="dateOfClaim"
              className={FORM_CONTROL_CLASS}
              value={field.state.value.length > 0 ? field.state.value : undefined}
              onChange={(value) => {
                field.handleChange(value ?? '')
              }}
              disabled={disabled}
              aria-label={m.emotive_claims_create_field_date_claim()}
            />
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="warrantyReport"
        children={(field) => (
          <InternalFieldGroup
            id="warrantyReport"
            label={m.emotive_claims_create_field_warranty_report()}
            className="sm:col-span-2"
            error={stepErrors['warrantyReport'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <textarea
              id="warrantyReport"
              className={TEXTAREA_FIELD_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </InternalFieldGroup>
        )}
      />
    </div>
  )
}
