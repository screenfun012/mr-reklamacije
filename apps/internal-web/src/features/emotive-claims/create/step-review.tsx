import {
  FaultType,
  type CustomerListItem,
  type DepartmentListItem,
  type EmployeeListItem,
  type EngineTypeListItem,
  type ExternalPartyListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'

import { TEXTAREA_FIELD_CLASS } from './form-field-styles.js'
import { formatFieldError } from './format-field-error.js'
import type { EmotiveClaimFormValues } from './emotive-claim-create-schemas.js'

interface StepReviewProps {
  values: EmotiveClaimFormValues
  customers: CustomerListItem[]
  engineTypes: EngineTypeListItem[]
  departments: DepartmentListItem[]
  employees: EmployeeListItem[]
  externalParties: ExternalPartyListItem[]
  form: {
    Field: React.ComponentType<{
      name: 'warrantyReport'
      children: (field: {
        state: { value: string; meta: { errors: unknown[] } }
        handleChange: (value: string) => void
        handleBlur: () => void
      }) => React.ReactNode
    }>
  }
  disabled: boolean
}

export function StepReview({
  values,
  customers,
  engineTypes,
  departments,
  employees,
  externalParties,
  form,
  disabled,
}: StepReviewProps): React.ReactElement {
  const customerName = customers.find((c) => c.id === values.customerId)?.name ?? '—'
  const engineTypeCode = engineTypes.find((e) => e.id === values.engineTypeId)?.code ?? '—'

  return (
    <div className="flex flex-col gap-6">
      <form.Field
        name="warrantyReport"
        children={(field) => (
          <div className="flex flex-col gap-1">
            <label htmlFor="warrantyReport" className="text-sm font-medium">
              {m.emotive_claims_create_field_warranty_report()}
            </label>
            <textarea
              id="warrantyReport"
              className={TEXTAREA_FIELD_CLASS}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              disabled={disabled}
            />
            {field.state.meta.errors.length > 0 ? (
              <span className="text-sm text-destructive">
                {formatFieldError(field.state.meta.errors[0])}
              </span>
            ) : null}
          </div>
        )}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{m.emotive_claims_create_review_basic_title()}</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <ReviewItem label={m.emotive_claims_create_field_mr_number()} value={values.mrNumber} />
          <ReviewItem
            label={m.emotive_claims_create_field_claim_number()}
            value={values.claimNumber || '—'}
          />
          <ReviewItem label={m.emotive_claims_create_field_customer()} value={customerName} />
          <ReviewItem label={m.emotive_claims_create_field_engine_type()} value={engineTypeCode} />
          <ReviewItem
            label={m.emotive_claims_create_field_engine_code()}
            value={values.engineCode || '—'}
          />
          <ReviewItem
            label={m.emotive_claims_create_field_date_finish()}
            value={values.dateOfFinish || '—'}
          />
          <ReviewItem
            label={m.emotive_claims_create_field_date_claim()}
            value={values.dateOfClaim}
          />
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{m.emotive_claims_create_review_faults_title()}</h2>
        {values.faults.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {m.emotive_claims_create_review_faults_empty()}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">{m.emotive_claims_create_fault_type()}</th>
                  <th className="px-4 py-2 font-medium">
                    {m.emotive_claims_create_review_fault_target()}
                  </th>
                </tr>
              </thead>
              <tbody>
                {values.faults.map((fault, index) => (
                  <tr key={`review-fault-${index}`} className="border-t border-border">
                    <td className="px-4 py-2">{faultLabel(fault.faultType)}</td>
                    <td className="px-4 py-2">
                      {resolveFaultTarget(fault, departments, employees, externalParties)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}

function faultLabel(faultType: string): string {
  switch (faultType) {
    case FaultType.Department:
      return m.emotive_claims_create_fault_type_department()
    case FaultType.Employee:
      return m.emotive_claims_create_fault_type_employee()
    case FaultType.External:
      return m.emotive_claims_create_fault_type_external()
    default:
      return faultType
  }
}

function resolveFaultTarget(
  fault: EmotiveClaimFormValues['faults'][number],
  departments: DepartmentListItem[],
  employees: EmployeeListItem[],
  externalParties: ExternalPartyListItem[],
): string {
  if (fault.faultType === FaultType.Department) {
    return departments.find((d) => d.id === fault.departmentId)?.nameSr ?? '—'
  }
  if (fault.faultType === FaultType.Employee) {
    return employees.find((e) => e.id === fault.employeeId)?.full_name ?? '—'
  }
  return externalParties.find((p) => p.id === fault.externalPartyId)?.name ?? '—'
}
