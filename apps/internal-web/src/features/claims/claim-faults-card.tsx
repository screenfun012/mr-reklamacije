import { m } from '@mr/i18n'
import { FaultType, type ClaimFaultItem } from '@mr/shared'
import { cn } from '@mr/ui'

import { InternalCard } from '~/components/internal-card'

export interface ClaimFaultsCardProps {
  faults: readonly ClaimFaultItem[]
}

/**
 * Who a claim blames, on the overview rather than a tab away (prototype §6). The pill carries
 * the KIND of blame in its colour — a worker, a department, an outside firm — because that is
 * the distinction the shop actually argues about, and it reads at a glance from across a desk.
 *
 * Read-only by design: the faults are part of the claim's DATA, so they are edited where the
 * rest of the data is, behind "Izmeni podatke", in one save (handoff §5, Nikola 2026-08-21).
 */
const PILL_CLASSES: Record<string, string> = {
  [FaultType.Employee]: 'bg-mri-warn-bg text-mri-warn',
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
    <InternalCard title={m.claim_detail_faults_title()} bodyClassName="px-[18px] py-[14px]">
      {faults.length === 0 ? (
        <p className="text-[12.5px] italic text-mri-text2">{m.claim_detail_faults_empty()}</p>
      ) : (
        <div className="flex flex-col gap-[9px]">
          {faults.map((fault, index) => {
            const name = blamedName(fault)
            // A fault's description is optional in this app while the wizard asks for one, so
            // most rows that exist today carry none. `?? '—'` only covered NULL: an empty
            // string fell through it and rendered nothing at all, which is how the row came
            // out as a number and a pill with a hole between them.
            const description = fault.notes?.trim() ?? ''
            return (
              <div key={fault.id} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[10px] font-semibold text-mri-text2">
                  {index + 1}
                </span>
                {description === '' ? (
                  // In words, not the handoff's bare dash: with the description empty the row
                  // came out as a number, a dash and a pill with a hole between them, and read
                  // as a screen that failed to load rather than a fault nobody wrote up.
                  <span className="text-[13px] italic text-mri-text2">
                    {m.claim_detail_fault_no_description()}
                  </span>
                ) : (
                  <span className="text-[13px] font-semibold text-mri-text">{description}</span>
                )}
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
    </InternalCard>
  )
}
