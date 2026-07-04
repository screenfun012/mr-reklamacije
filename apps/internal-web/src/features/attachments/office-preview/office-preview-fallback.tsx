import { m } from '@mr/i18n'
import { AttachmentFileIcon } from '@mr/ui'

export type OfficePreviewFallbackVariant = 'error' | 'too_large'

export interface OfficePreviewFallbackProps {
  mimeType: string
  variant: OfficePreviewFallbackVariant
}

export function OfficePreviewFallback({
  mimeType,
  variant,
}: OfficePreviewFallbackProps): React.ReactElement {
  const message =
    variant === 'too_large'
      ? m.claim_attachments_office_too_large()
      : m.claim_attachments_office_error()

  return (
    <div
      className="flex h-full min-h-[12rem] w-full flex-1 items-center justify-center p-4"
      data-testid="office-preview-fallback"
    >
      <div className="flex max-w-lg flex-col items-center gap-4 rounded-[14px] border border-mri-border bg-mri-surface bg-background p-8 text-center">
        <AttachmentFileIcon mimeType={mimeType} className="size-16 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
