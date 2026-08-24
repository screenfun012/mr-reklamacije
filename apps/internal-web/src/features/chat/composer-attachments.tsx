import { m } from '@mr/i18n'
import { formatAttachmentFileSize } from '@mr/shared'
import { cn } from '@mr/ui'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * The tile the prototype draws for a photo in a bubble (`cet-prototip.dc.html` L126): 104×74,
 * radius 9, a hairline, and the file name in mono when there is no picture to show.
 *
 * The composer reuses it deliberately — what a person picks should look like what they are about
 * to send, and it is the only attachment geometry the prototype defines.
 */
export const CHAT_TILE_CLASSES =
  'relative grid h-[74px] w-[104px] flex-none place-items-center overflow-hidden rounded-[9px] border border-mri-border2 bg-mri-inbg'

/** One picked file, plus the object URL drawn for it while it is still only in the browser. */
export interface PickedFile {
  readonly id: string
  readonly file: File
}

export interface ComposerAttachmentsProps {
  files: readonly PickedFile[]
  onRemove: (id: string) => void
}

/**
 * What is about to be sent, above the field.
 *
 * ⚠ Above it, never inside it. The field is a textarea with a mirrored copy drawn behind it to
 * colour the mentions, and `composer.tsx` records why: any difference in padding between the two
 * drifts the caret.
 */
export function ComposerAttachments({
  files,
  onRemove,
}: ComposerAttachmentsProps): React.ReactElement | null {
  if (files.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-[7px] border-b border-mri-border bg-mri-inbg px-4 py-2.5">
      {files.map((picked) => (
        <PickedTile key={picked.id} picked={picked} onRemove={() => onRemove(picked.id)} />
      ))}
    </div>
  )
}

function PickedTile({
  picked,
  onRemove,
}: {
  picked: PickedFile
  onRemove: () => void
}): React.ReactElement {
  const preview = useObjectUrl(picked.file)
  const isImage = picked.file.type.startsWith('image/')

  return (
    <div className={CHAT_TILE_CLASSES}>
      {isImage && preview !== null ? (
        <img src={preview} alt={picked.file.name} className="size-full object-cover" />
      ) : (
        <span className="px-2 text-center font-mono text-[9px] font-medium text-mri-text2">
          <span className="block truncate">{picked.file.name}</span>
          <span className="block">{formatAttachmentFileSize(picked.file.size)}</span>
        </span>
      )}
      <button
        type="button"
        title={m.chat_attachment_remove()}
        onClick={onRemove}
        className={cn(
          'absolute right-1 top-1 grid size-5 cursor-pointer place-items-center rounded-full',
          'bg-black/60 text-white transition-colors hover:bg-mri-red',
        )}
      >
        <X aria-hidden="true" className="size-3" />
        <span className="sr-only">{m.chat_attachment_remove()}</span>
      </button>
    </div>
  )
}

/**
 * A preview URL that is released the moment it stops being drawn.
 *
 * ⚠ Without the revoke the browser holds every photo the person picked for the whole session —
 * the optimistic row is dropped by clientMsgId as soon as the server's row lands, so these
 * unmount constantly. Same shape as the intake queue's own revoke.
 */
function useObjectUrl(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
      setUrl(null)
    }
  }, [file])

  return url
}
