import { m } from '@mr/i18n'
import { FaultType, type ClaimFaultItem } from '@mr/shared'
import { cn } from '@mr/ui'

export interface ClaimFaultsCardProps {
  faults: readonly ClaimFaultItem[]
}

/**
 * Who a claim blames, on the overview rather than a tab away (prototype §6). The pill carries
 * the KIND of blame in its colour — a worker, a department, an outside firm — because that is
 * the distinction the shop actually argues about, and it reads at a glance from across a desk.
 *
 * Editing still lives on the Kvarovi tab: this card is the answer, not the argument.
 */
const PILL_CLASSES: Record<string, string> = {
  [FaultType.Employee]: 'bg-[rgba(234,179,8,.13)] text-mri-amb',
  [FaultType.Department]: 'bg-mri-domace-bg text-mri-domace',
  [FaultType.External]: 'bg-mri-info-bg text-mri-info',
}

const PILL_LABELS: Record<string, () => string> = {
  [FaultType.Employee]: m.emotive_claims_create_fault_type_employee,
  [FaultType.Department]: m.emotive_claims_create_fault_type_department,
  [FaultType.External]: m.emotive_claims_create_fault_type_external,
}

function blamedName(fault: ClaimFaultItem): string | null {
  if (fault.faultType === FaultType.Employee) {
    return fault.employeeName
  }
  if (fault.faultType === FaultType.Department) {
    return fault.departmentName
  }
  return fault.externalPartyName
}

export function ClaimFaultsCard({ faults }: ClaimFaultsCardProps): React.ReactElement {
  return (
    <section className="overflow-hidden rounded-[14px] border border-mri-border bg-mri-surface">
      <h2 className="border-b border-mri-border px-[18px] py-[13px] text-[14.5px] font-extrabold text-mri-text">
        {m.claim_detail_faults_title()}
      </h2>

      {faults.length === 0 ? (
        <p className="px-[18px] py-[14px] text-[12.5px] italic text-mri-text2">
          {m.claim_detail_faults_empty()}
        </p>
      ) : (
        <div className="flex flex-col gap-[9px] px-[18px] py-[14px]">
          {faults.map((fault, index) => {
            const name = blamedName(fault)
            return (
              <div key={fault.id} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[10px] font-semibold text-mri-text2">
                  {index + 1}
                </span>
                <span className="text-[13px] font-semibold text-mri-text">
                  {fault.notes?.trim() ?? '—'}
                </span>
                <span
                  className={cn(
                    'ml-auto rounded-full px-[9px] py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em]',
                    PILL_CLASSES[fault.faultType],
                  )}
                >
                  {PILL_LABELS[fault.faultType]?.()}
                  {name === null ? '' : ` · ${name}`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
