import { useRef, useState } from 'react'

import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { FileText, ImageIcon, Paperclip, X } from 'lucide-react'

/** Kept modest — the API rate-limits and validates; the picker is just a courtesy cap. */
const MAX_FILES = 10

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${Math.round(kb)} KB`
  }
  return `${(kb / 1024).toFixed(1)} MB`
}

/**
 * On-brand file picker for the "Prijavi problem" form. The portal had no upload
 * UI, so this is a new component built from portal tokens only: a dashed
 * click/drop zone (--inbg surface, red hover/drag ring like .mrp-input focus)
 * plus a list of selected files with per-file remove. Controlled by the form.
 */
export function AttachmentPicker({
  files,
  onChange,
  disabled = false,
}: {
  files: readonly File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = (incoming: FileList | null): void => {
    if (incoming === null || incoming.length === 0) {
      return
    }
    onChange([...files, ...Array.from(incoming)].slice(0, MAX_FILES))
  }

  const removeAt = (index: number): void => {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          addFiles(event.dataTransfer.files)
        }}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-[12px] border border-dashed border-mrp-border2 bg-mrp-inbg px-6 py-8 text-center transition-colors',
          'hover:border-mrp-red disabled:cursor-not-allowed disabled:opacity-60',
          dragging && 'border-mrp-red bg-[rgba(237,28,36,0.06)]',
        )}
      >
        <Paperclip className="size-5 text-mrp-text2" />
        <span className="text-[14px] font-semibold text-mrp-text">
          {m.portal_submit_attachments_cta()}
        </span>
        <span className="text-[12.5px] text-mrp-text2">{m.portal_submit_attachments_hint()}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((file, index) => {
            const isImage = file.type.startsWith('image/')
            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-3 rounded-[9px] border border-mrp-border bg-mrp-surface px-3.5 py-2.5"
              >
                {isImage ? (
                  <ImageIcon className="size-4 flex-none text-mrp-text2" />
                ) : (
                  <FileText className="size-4 flex-none text-mrp-text2" />
                )}
                <span className="truncate text-[13.5px] font-medium text-mrp-text">
                  {file.name}
                </span>
                <span className="ml-auto flex-none font-mono text-[11.5px] text-mrp-text2">
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  aria-label={m.portal_submit_attachments_remove()}
                  className="flex-none rounded-md p-1 text-mrp-text2 transition-colors hover:text-mrp-redh disabled:cursor-not-allowed"
                >
                  <X className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
