import { clientSubmissionDetailOptions, formatListDateTime } from '@mr/shared'
import { m } from '@mr/i18n'
import { Skeleton } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense, useState } from 'react'

import { InternalButton } from '~/components/internal-button'
import { InternalCard, InternalCardHeader } from '~/components/internal-card'

import { ConvertClaimForm } from './convert-claim-form'
import { RejectSubmissionDialog } from './reject-submission-dialog'
import { SubmissionAttachments } from './submission-attachments'
import { useRejectSubmission } from './use-reject-submission'

type DetailMode = 'detail' | 'convert'

export interface InboxDetailViewProps {
  id: string
}

/** Inbox detail: message + attachments, with in-place "Open claim" (convert) and "Dismiss". */
export function InboxDetailView({ id }: InboxDetailViewProps): React.ReactElement {
  const { data: submission } = useSuspenseQuery(clientSubmissionDetailOptions(id))
  const [mode, setMode] = useState<DetailMode>('detail')

  const header = (
    <div>
      <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-mri-text">
        {submission.customerName}
      </h1>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-mri-text2">
        {m.internal_inbox_col_received()} · {formatListDateTime(submission.createdAt)}
      </p>
    </div>
  )

  if (mode === 'convert') {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div>
          <h2 className="text-[15px] font-extrabold text-mri-text">
            {m.internal_inbox_convert_title()}
          </h2>
          <p className="mt-1 text-sm text-mri-text2">{m.internal_inbox_convert_subtitle()}</p>
        </div>
        <Suspense fallback={<ConvertFormSkeleton />}>
          <ConvertClaimForm submission={submission} onCancel={() => setMode('detail')} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <InternalCard>
        <InternalCardHeader title={m.internal_inbox_detail_reason()} />
        <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-mri-text">
          {submission.message}
        </p>
      </InternalCard>

      <InternalCard>
        <InternalCardHeader title={m.internal_inbox_detail_attachments()} />
        <div className="px-5 py-4">
          <Suspense fallback={<AttachmentsSkeleton />}>
            <SubmissionAttachments submissionId={id} />
          </Suspense>
        </div>
      </InternalCard>

      <InboxDetailActions submissionId={id} onConvert={() => setMode('convert')} />
    </div>
  )
}

function InboxDetailActions({
  submissionId,
  onConvert,
}: {
  submissionId: string
  onConvert: () => void
}): React.ReactElement {
  const [rejectOpen, setRejectOpen] = useState(false)
  const rejectMutation = useRejectSubmission(submissionId)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <InternalButton
        type="button"
        variant="primary"
        className="h-[46px] w-auto px-[22px] text-[12.5px]"
        onClick={onConvert}
      >
        {m.internal_inbox_action_convert()}
      </InternalButton>
      <InternalButton
        type="button"
        variant="outline-red"
        className="h-[46px] w-auto px-[22px] text-[12.5px]"
        onClick={() => setRejectOpen(true)}
      >
        {m.internal_inbox_action_reject()}
      </InternalButton>

      <RejectSubmissionDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        rejecting={rejectMutation.isPending}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
      />
    </div>
  )
}

function AttachmentsSkeleton(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="aspect-square rounded-[10px]" />
      ))}
    </div>
  )
}

function ConvertFormSkeleton(): React.ReactElement {
  return (
    <div
      className="flex flex-col gap-4 rounded-[14px] border border-mri-border bg-mri-surface p-6"
      aria-busy="true"
    >
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-[46px] w-40 self-end" />
    </div>
  )
}
