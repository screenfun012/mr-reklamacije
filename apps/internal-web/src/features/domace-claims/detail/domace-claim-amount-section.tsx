import { formatEuroAmount, type DomaceClaimDetail } from '@mr/shared'
import { m } from '@mr/i18n'

interface DomaceClaimAmountSectionProps {
  claim: DomaceClaimDetail
}

function AmountRow({ label, value }: { label: string; value: number | null }): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-mri-text2">{label}</span>
      <span className="font-mono text-sm tabular-nums text-mri-text">
        {value === null ? '—' : formatEuroAmount(value)}
      </span>
    </div>
  )
}

/**
 * Read-only DOMACE money breakdown (docs/23): original invoice, parts ex-VAT,
 * labor ex-VAT, and the computed UKUPNO. Shown once any amount is recorded —
 * amounts are captured in any outcome state now, not only when accepted.
 */
export function DomaceClaimAmountSection({
  claim,
}: DomaceClaimAmountSectionProps): React.ReactElement | null {
  const hasAny =
    claim.originalInvoiceAmount !== null ||
    claim.partsAmount !== null ||
    claim.laborAmount !== null ||
    claim.totalAmount !== null
  if (!hasAny) {
    return null
  }

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
      <h2 className="text-[15px] font-extrabold text-mri-text">
        {m.domace_claims_detail_section_amount()}
      </h2>

      <div className="flex flex-col gap-2">
        <AmountRow
          label={m.domace_claims_create_field_original_invoice_amount()}
          value={claim.originalInvoiceAmount}
        />
        <AmountRow label={m.domace_claims_create_field_parts_amount()} value={claim.partsAmount} />
        <AmountRow label={m.domace_claims_create_field_labor_amount()} value={claim.laborAmount} />
        <div className="mt-1 border-t border-mri-border pt-2">
          <AmountRow label={m.domace_claims_create_field_total()} value={claim.totalAmount} />
        </div>
      </div>
    </section>
  )
}
