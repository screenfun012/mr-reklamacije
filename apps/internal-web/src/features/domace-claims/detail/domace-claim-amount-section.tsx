import { ApiError, ClaimOutcome, formatEuroAmount, type DomaceClaimDetail } from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, Heading, Input } from '@mr/ui'
import { useState } from 'react'

import { useUpdateDomaceClaimAmount } from './use-update-domace-claim-amount.js'

interface DomaceClaimAmountSectionProps {
  claim: DomaceClaimDetail
  canEdit: boolean
}

export function DomaceClaimAmountSection({
  claim,
  canEdit,
}: DomaceClaimAmountSectionProps): React.ReactElement | null {
  if (claim.outcome !== ClaimOutcome.Accepted) {
    return null
  }

  return <AmountEditor claim={claim} canEdit={canEdit} />
}

function AmountEditor({
  claim,
  canEdit,
}: {
  claim: DomaceClaimDetail
  canEdit: boolean
}): React.ReactElement {
  const [amountInput, setAmountInput] = useState(() => formatAmountInput(claim.totalAmount))
  const [saveError, setSaveError] = useState<string | null>(null)
  const mutation = useUpdateDomaceClaimAmount(claim.id)

  const handleSave = (): void => {
    setSaveError(null)
    const trimmed = amountInput.trim()
    if (trimmed === '') {
      mutation.mutate(null, {
        onSuccess: () => setAmountInput(''),
        onError: (error) => setSaveError(resolveSaveError(error)),
      })
      return
    }

    const parsed = Number(trimmed.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setSaveError(m.domace_claims_detail_amount_invalid())
      return
    }

    mutation.mutate(parsed, {
      onSuccess: (updated) => setAmountInput(formatAmountInput(updated.totalAmount)),
      onError: (error) => setSaveError(resolveSaveError(error)),
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-6">
      <Heading level="h3" as="h2" className="text-foreground">
        {m.domace_claims_detail_section_amount()}
      </Heading>

      {claim.totalAmount !== null ? (
        <p className="text-sm text-muted-foreground">
          {m.domace_claims_detail_amount_current()}:{' '}
          <span className="font-medium text-foreground">{formatEuroAmount(claim.totalAmount)}</span>
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex flex-col gap-3">
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
              onChange={(event) => setAmountInput(event.target.value)}
              disabled={mutation.isPending}
              placeholder="0,00"
            />
          </div>

          {saveError ? (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          ) : null}

          <div>
            <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending
                ? m.domace_claims_detail_amount_saving()
                : m.domace_claims_detail_amount_save()}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function formatAmountInput(value: number | null): string {
  if (value === null) {
    return ''
  }
  return String(value)
}

function resolveSaveError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return m.domace_claims_detail_amount_save_error()
}
