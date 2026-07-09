import { m } from '@mr/i18n'
import { Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'

import { cn } from '../../lib/cn.js'

export interface ClaimAttachmentsDropzoneProps {
  disabled?: boolean
  uploading?: boolean
  uploadPercent?: number
  accept?: string
  onFilesSelected: (files: File[]) => void
}

export function ClaimAttachmentsDropzone({
  disabled = false,
  uploading = false,
  uploadPercent = 0,
  accept,
  onFilesSelected,
}: ClaimAttachmentsDropzoneProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const isDisabled = disabled || uploading

  const handleFiles = (fileList: FileList | null): void => {
    if (fileList === null || fileList.length === 0) {
      return
    }

    onFilesSelected([...fileList])
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (!isDisabled) {
      setDragActive(true)
    }
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragActive(false)

    if (isDisabled) {
      return
    }

    handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-disabled={isDisabled}
        aria-busy={uploading}
        className={cn(
          'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-mri-border bg-mri-inbg p-6 text-center transition-colors',
          dragActive && 'border-mri-red bg-mri-red/5',
          isDisabled && 'cursor-not-allowed opacity-60',
        )}
        onClick={() => {
          if (!isDisabled) {
            inputRef.current?.click()
          }
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !isDisabled) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="claim-attachments-dropzone"
      >
        <Upload className="size-8 text-mri-text2" aria-hidden />
        <p className="text-sm font-medium text-mri-text">{m.claim_attachments_dropzone_title()}</p>
        <p className="max-w-md text-xs text-mri-text2">{m.claim_attachments_dropzone_hint()}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          disabled={isDisabled}
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {uploading ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-mri-inbg">
            <div
              className="h-full bg-mri-red transition-[width] duration-150"
              style={{ width: `${uploadPercent}%` }}
            />
          </div>
          <p className="text-xs text-mri-text2">
            {m.claim_attachments_uploading({ percent: uploadPercent })}
          </p>
        </div>
      ) : null}
    </div>
  )
}
