import { m } from '@mr/i18n'
import { Skeleton } from '@mr/ui'

export function OfficePreviewLoading(): React.ReactElement {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 flex-col gap-3 p-4"
      aria-live="polite"
      data-testid="office-preview-loading"
    >
      <p className="text-sm text-muted-foreground">{m.claim_attachments_office_loading()}</p>
      <Skeleton className="min-h-[12rem] w-full flex-1 rounded-md" />
    </div>
  )
}
