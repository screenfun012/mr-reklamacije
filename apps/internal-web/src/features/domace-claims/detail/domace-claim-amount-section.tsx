import { ApiError, ClaimOutcome, formatEuroAmount, type DomaceClaimDetail } from '@mr/shared'
import { m } from '@mr/i18n'
import { Input } from '@mr/ui'

interface DomaceClaimAmountSectionProps {
  claim: DomaceClaimDetail
}

export function DomaceClaimAmountSection({
  claim,
}: DomaceClaimAmountSectionProps): React.ReactElement | null {
  if (claim.outcome !== ClaimOutcome.Accepted) {
    return null
  }

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-mri-border bg-mri-surface p-6">
      <h2 className="text-[15px] font-extrabold text-mri-text">
        {m.domace_claims_detail_section_amount()}
      </h2>

      {claim.totalAmount !== null ? (
        <p className="text-sm text-muted-foreground">
          {m.domace_claims_detail_amount_current()}:{' '}
          <span className="font-medium text-foreground">{formatEuroAmount(claim.totalAmount)}</span>
        </p>
      ) : null}
    </section>
  )
}

export function DomaceClaimAmountEditField({
  amountInput,
  onAmountInputChange,
  disabled,
}: {
  amountInput: string
  onAmountInputChange: (value: string) => void
  disabled?: boolean
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="repairAmount" className="text-sm font-medium">
        {m.domace_claims_detail_field_repair_cost()}
      </label>
      <Input
        id="repairAmount"
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={amountInput}
        onChange={(event) => onAmountInputChange(event.target.value)}
        disabled={disabled === true}
        placeholder="0,00"
      />
    </div>
  )
}

export function formatAmountInput(value: number | null): string {
  if (value === null) {
    return ''
  }
  return String(value)
}

export function parseDomaceAmountInput(
  amountInput: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = amountInput.trim()
  if (trimmed === '') {
    return { ok: true, value: null }
  }

  const parsed = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, error: m.domace_claims_detail_amount_invalid() }
  }

  return { ok: true, value: parsed }
}

export function resolveAmountSaveError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return m.domace_claims_detail_amount_save_error()
}
