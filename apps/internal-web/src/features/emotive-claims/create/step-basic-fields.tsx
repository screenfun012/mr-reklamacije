import type { CustomerListItem, EngineTypeListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import { Input } from '@mr/ui'

import { SELECT_FIELD_CLASS } from './form-field-styles.js'
import { formatFieldError } from './format-field-error.js'
import type { EmotiveClaimFormValues } from './emotive-claim-create-schemas.js'

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
  }
  customers: CustomerListItem[]
  engineTypes: EngineTypeListItem[]
  stepErrors: Record<string, string>
  disabled: boolean
}

export function StepBasicFields({
  form,
  customers,
  engineTypes,
  stepErrors,
  disabled,
}: StepBasicFieldsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <form.Field
        name="mrNumber"
        children={(field) => (
          <FieldGroup
            id="mrNumber"
            label={m.emotive_claims_create_field_mr_number()}
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
          <FieldGroup id="claimNumber" label={m.emotive_claims_create_field_claim_number()}>
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
        name="customerId"
        children={(field) => (
          <FieldGroup
            id="customerId"
            label={m.emotive_claims_create_field_customer()}
            error={stepErrors['customerId'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <select
              id="customerId"
              className={SELECT_FIELD_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            >
              <option value="">{m.emotive_claims_create_select_placeholder()}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </FieldGroup>
        )}
      />

      <form.Field
        name="engineTypeId"
        children={(field) => (
          <FieldGroup
            id="engineTypeId"
            label={m.emotive_claims_create_field_engine_type()}
            error={stepErrors['engineTypeId'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <select
              id="engineTypeId"
              className={SELECT_FIELD_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            >
              <option value="">{m.emotive_claims_create_select_placeholder()}</option>
              {engineTypes.map((engineType) => (
                <option key={engineType.id} value={engineType.id}>
                  {engineType.code}
                </option>
              ))}
            </select>
          </FieldGroup>
        )}
      />

      <form.Field
        name="engineCode"
        children={(field) => (
          <FieldGroup id="engineCode" label={m.emotive_claims_create_field_engine_code()}>
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
            label={m.emotive_claims_create_field_date_finish()}
            error={stepErrors['dateOfFinish'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <Input
              id="dateOfFinish"
              type="date"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
          </FieldGroup>
        )}
      />

      <form.Field
        name="dateOfClaim"
        children={(field) => (
          <FieldGroup
            id="dateOfClaim"
            label={m.emotive_claims_create_field_date_claim()}
            error={stepErrors['dateOfClaim'] ?? formatFieldError(field.state.meta.errors[0])}
          >
            <Input
              id="dateOfClaim"
              type="date"
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
  error?: string
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
