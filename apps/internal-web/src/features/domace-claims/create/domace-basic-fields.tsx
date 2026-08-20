import { computeDomaceTotal, formatEuroAmount, formatFieldError } from '@mr/shared'
import type {
  ClaimCategoryListItem,
  EmployeeListItem,
  EngineManufacturerListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { DatePicker, Input, SearchableSelect } from '@mr/ui'

import { InternalFieldGroup } from '~/components/internal-field-group'
import { emptyToAmount } from './domace-claim-create-schemas.js'

import { EngineTypeSearchableSelectField } from '../../claims/engine-type-searchable-select-field.js'
import { MrDuplicateWarning } from '../../claims/mr-duplicate-warning.js'
import type { EngineTypeOrphanOption } from '../../claims/engine-type-options.js'
import {
  FORM_CONTROL_CLASS,
  TEXTAREA_FIELD_CLASS,
} from '../../emotive-claims/create/form-field-styles.js'
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
  employees: EmployeeListItem[]
  manufacturers: EngineManufacturerListItem[]
  categories: ClaimCategoryListItem[]
  orphanEngineType?: EngineTypeOrphanOption | undefined
  stepErrors: Record<string, string>
  disabled: boolean
  /** Create-only: detail edit reuses these fields, where the claim's own MR would false-positive. */
  checkMrDuplicate?: boolean
  /** Edit-only: keep the claim's current assigned worker selectable if outside assembly. */
  currentAssignedWorkerName?: string | undefined
  /** Edit-only: keep the claim's current category selectable even if since deactivated. */
  currentCategoryName?: string | undefined
}

export function DomaceBasicFields({
  form,
  employees,
  manufacturers,
  categories,
  orphanEngineType,
  stepErrors,
  disabled,
  checkMrDuplicate = false,
  currentAssignedWorkerName,
  currentCategoryName,
}: DomaceBasicFieldsProps): React.ReactElement {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form.Field
        name="mrNumber"
        children={(field) => (
          <InternalFieldGroup
            id="mrNumber"
            label={m.domace_claims_create_field_mr_number()}
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
          <InternalFieldGroup id="claimNumber" label={m.domace_claims_create_field_claim_number()}>
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
        name="invoiceNumber"
        children={(field) => (
          <InternalFieldGroup
            id="invoiceNumber"
            label={m.domace_claims_create_field_invoice_number()}
          >
            <Input
              id="invoiceNumber"
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
        name="customerName"
        children={(field) => (
          <InternalFieldGroup
            id="customerName"
            label={m.domace_claims_create_field_customer_name()}
            error={stepErrors['customerName']}
          >
            <Input
              id="customerName"
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
        name="manufacturerId"
        children={(field) => (
          <InternalFieldGroup
            id="manufacturerId"
            label={m.emotive_claims_create_field_manufacturer()}
            error={stepErrors['manufacturerId']}
          >
            <SearchableSelect
              id="manufacturerId"
              className={FORM_CONTROL_CLASS}
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
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="categoryId"
        children={(field) => {
          // Keep the claim's current category selectable even if since deactivated
          // (mirrors ZAPOSLENI above) — a switched-off category must not silently
          // drop off a claim that carries it.
          const options = categories.map((category) => ({
            value: category.id,
            label: category.name,
            keywords: category.code,
          }))
          if (
            field.state.value !== '' &&
            !options.some((option) => option.value === field.state.value)
          ) {
            options.unshift({
              value: field.state.value,
              label: currentCategoryName ?? field.state.value,
              keywords: '',
            })
          }
          return (
            <InternalFieldGroup
              id="categoryId"
              label={m.field_claim_category()}
              required
              error={stepErrors['categoryId'] ?? formatFieldError(field.state.meta.errors[0])}
            >
              <SearchableSelect
                id="categoryId"
                className={FORM_CONTROL_CLASS}
                value={field.state.value}
                options={options}
                placeholder={m.emotive_claims_create_select_placeholder()}
                searchPlaceholder={m.field_search_placeholder()}
                emptyOptionLabel={m.emotive_claims_create_select_placeholder()}
                noResultsLabel={m.field_no_results()}
                disabled={disabled}
                aria-label={m.field_claim_category()}
                onValueChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            </InternalFieldGroup>
          )
        }}
      />

      <form.Subscribe selector={(state) => state.values.manufacturerId}>
        {(manufacturerId) => (
          <form.Field
            name="engineTypeId"
            children={(field) => (
              <InternalFieldGroup
                id="engineTypeId"
                label={m.domace_claims_create_field_engine_type()}
              >
                <EngineTypeSearchableSelectField
                  id="engineTypeId"
                  className={FORM_CONTROL_CLASS}
                  value={field.state.value}
                  manufacturerId={manufacturerId}
                  orphanEngineType={orphanEngineType}
                  disabled={disabled}
                  aria-label={m.domace_claims_create_field_engine_type()}
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
          <InternalFieldGroup id="engineCode" label={m.domace_claims_create_field_engine_code()}>
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
        children={(field) => {
          // ZAPOSLENI for DOMACE = any active employee, searchable. Keep the
          // claim's current worker selectable even if since deactivated.
          const options = employees.map((employee) => ({
            value: employee.id,
            label: employee.fullName,
          }))
          if (
            field.state.value !== '' &&
            !options.some((option) => option.value === field.state.value)
          ) {
            options.unshift({
              value: field.state.value,
              label: currentAssignedWorkerName ?? field.state.value,
            })
          }
          return (
            <InternalFieldGroup id="employeeId" label={m.domace_claims_create_field_employee()}>
              <SearchableSelect
                id="employeeId"
                className={FORM_CONTROL_CLASS}
                value={field.state.value}
                options={options}
                placeholder={m.emotive_claims_create_select_placeholder()}
                searchPlaceholder={m.field_search_placeholder()}
                emptyOptionLabel={m.emotive_claims_create_select_placeholder()}
                noResultsLabel={m.field_no_results()}
                disabled={disabled}
                aria-label={m.domace_claims_create_field_employee()}
                onValueChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            </InternalFieldGroup>
          )
        }}
      />

      <form.Field
        name="dateOfFinish"
        children={(field) => (
          <InternalFieldGroup
            id="dateOfFinish"
            label={m.domace_claims_create_field_date_finish()}
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
              aria-label={m.domace_claims_create_field_date_finish()}
            />
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="dateOfClaim"
        children={(field) => (
          <InternalFieldGroup
            id="dateOfClaim"
            label={m.domace_claims_create_field_date_claim()}
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
              aria-label={m.domace_claims_create_field_date_claim()}
            />
          </InternalFieldGroup>
        )}
      />

      <form.Field
        name="originalInvoiceAmount"
        children={(field) => (
          <InternalFieldGroup
            id="originalInvoiceAmount"
            label={m.domace_claims_create_field_original_invoice_amount()}
            error={
              stepErrors['originalInvoiceAmount'] ?? formatFieldError(field.state.meta.errors[0])
            }
          >
            <Input
              id="originalInvoiceAmount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
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
        name="partsAmount"
        children={(field) => (
          <InternalFieldGroup
            id="partsAmount"
            label={m.domace_claims_create_field_parts_amount()}
            error={stepErrors['partsAmount'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <Input
              id="partsAmount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
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
        name="laborAmount"
        children={(field) => (
          <InternalFieldGroup
            id="laborAmount"
            label={m.domace_claims_create_field_labor_amount()}
            error={stepErrors['laborAmount'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <Input
              id="laborAmount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className={FORM_CONTROL_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </InternalFieldGroup>
        )}
      />

      <InternalFieldGroup id="domaceTotal" label={m.domace_claims_create_field_total()}>
        <form.Subscribe
          selector={(state) => {
            const total = computeDomaceTotal(
              emptyToAmount(state.values.partsAmount),
              emptyToAmount(state.values.laborAmount),
            )
            return total === null ? '—' : formatEuroAmount(total)
          }}
        >
          {(total) => (
            <output
              id="domaceTotal"
              className={`${FORM_CONTROL_CLASS} flex items-center font-mono tabular-nums`}
            >
              {total}
            </output>
          )}
        </form.Subscribe>
      </InternalFieldGroup>

      <form.Field
        name="warrantyReport"
        children={(field) => (
          <InternalFieldGroup
            id="warrantyReport"
            label={m.domace_claims_create_field_warranty_report()}
            className="sm:col-span-2"
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
