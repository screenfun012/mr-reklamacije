import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  AttachmentPreviewKind,
  AttachmentVisibility,
  attachmentKeys,
  attachmentsListOptions,
  getAttachmentPreviewKind,
  type AttachmentListItem,
  type ClaimKind,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  ClaimAttachmentDeleteDialog,
  ClaimAttachmentPreviewDialog,
  ClaimAttachmentsDropzone,
  ClaimAttachmentsGrid,
  Skeleton,
  toast,
} from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { uploadClaimAttachments } from './upload-claim-attachments.js'
import {
  isOfficeAttachmentMimeType,
  OfficeAttachmentPreview,
} from './office-preview/office-attachment-preview.js'

export interface ClaimAttachmentsTabProps {
  claimKind: ClaimKind
  claimId: string
  canUpload: boolean
  canDeleteItem: (item: AttachmentListItem) => boolean
}

const ACCEPT_MIME_TYPES = ALLOWED_ATTACHMENT_MIME_TYPES.join(',')

export function ClaimAttachmentsTab({
  claimKind,
  claimId,
  canUpload,
  canDeleteItem,
}: ClaimAttachmentsTabProps): React.ReactElement {
  const queryClient = useQueryClient()
  const listKey = attachmentKeys.list(claimKind, claimId)
  const { data, isLoading } = useQuery(attachmentsListOptions(claimKind, claimId))

  const [uploadPercent, setUploadPercent] = useState(0)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentListItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteAttachment, setDeleteAttachment] = useState<AttachmentListItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const items = data?.items ?? []

  const imageAttachments = useMemo(
    () =>
      items.filter(
        (item) => getAttachmentPreviewKind(item.mimeType) === AttachmentPreviewKind.Image,
      ),
    [items],
  )

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      uploadClaimAttachments({
        claimKind,
        claimId,
        visibility: AttachmentVisibility.Internal,
        files,
        onProgress: (loaded, total) => {
          setUploadPercent(total > 0 ? Math.round((loaded / total) * 100) : 0)
        },
      }),
    onSuccess: (result) => {
      toast.success(m.claim_attachments_upload_success())
      if (result.skippedDuplicates > 0) {
        toast.message(m.claim_attachments_duplicates_skipped({ count: result.skippedDuplicates }))
      }
    },
    onError: () => {
      toast.error(m.claim_attachments_upload_error())
    },
    onSettled: async () => {
      setUploadPercent(0)
      await queryClient.invalidateQueries({ queryKey: listKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/attachments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }
    },
    onSuccess: () => {
      toast.success(m.claim_attachments_delete_success())
      setDeleteOpen(false)
      setDeleteAttachment(null)
    },
    onError: () => {
      toast.error(m.claim_attachments_delete_error())
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: listKey })
    },
  })

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0 || !canUpload) {
        return
      }

      uploadMutation.mutate(files)
    },
    [canUpload, uploadMutation],
  )

  const handleOpenPreview = useCallback((item: AttachmentListItem) => {
    setPreviewAttachment(item)
    setPreviewOpen(true)
  }, [])

  const handleDeleteRequest = useCallback((item: AttachmentListItem) => {
    setDeleteAttachment(item)
    setDeleteOpen(true)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {canUpload ? (
        <ClaimAttachmentsDropzone
          uploading={uploadMutation.isPending}
          uploadPercent={uploadPercent}
          accept={ACCEPT_MIME_TYPES}
          onFilesSelected={handleFilesSelected}
        />
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : (
        <ClaimAttachmentsGrid
          items={items}
          canDelete={canDeleteItem}
          onOpen={handleOpenPreview}
          onDelete={handleDeleteRequest}
        />
      )}

      <ClaimAttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        attachment={previewAttachment}
        imageAttachments={imageAttachments}
        onNavigate={setPreviewAttachment}
        officePreview={
          previewAttachment !== null && isOfficeAttachmentMimeType(previewAttachment.mimeType) ? (
            <OfficeAttachmentPreview attachment={previewAttachment} />
          ) : undefined
        }
      />

      <ClaimAttachmentDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        attachment={deleteAttachment}
        deleting={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteAttachment !== null) {
            deleteMutation.mutate(deleteAttachment.id)
          }
        }}
      />
    </div>
  )
}
