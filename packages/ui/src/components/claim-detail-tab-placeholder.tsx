import { m } from '@mr/i18n'

export interface ClaimDetailTabPlaceholderProps {
  message?: string
}

export function ClaimDetailTabPlaceholder({
  message,
}: ClaimDetailTabPlaceholderProps): React.ReactElement {
  return (
    <div
      className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border p-8"
      data-testid="claim-detail-tab-placeholder"
    >
      <p className="text-sm text-muted-foreground">{message ?? m.claim_detail_tab_coming_soon()}</p>
    </div>
  )
}
