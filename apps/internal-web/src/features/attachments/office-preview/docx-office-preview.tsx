import { cn } from '@mr/ui'
import { useEffect, useRef, useState } from 'react'

import { fetchAttachmentBuffer } from './fetch-attachment-buffer.js'
import { WORD_MIME } from './office-preview-constants.js'
import { OfficePreviewFallback } from './office-preview-fallback.js'
import { OfficePreviewLoading } from './office-preview-loading.js'

export interface DocxOfficePreviewProps {
  fetchUrl: string
}

type LoadState = 'loading' | 'ready' | 'error'

export default function DocxOfficePreview({
  fetchUrl,
}: DocxOfficePreviewProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current

    async function loadDocument(): Promise<void> {
      if (container === null) {
        return
      }

      container.replaceChildren()

      try {
        const buffer = await fetchAttachmentBuffer(fetchUrl)
        const { renderAsync } = await import('docx-preview')

        await renderAsync(buffer, container, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
        })

        if (!cancelled) {
          setState('ready')
        }
      } catch {
        if (!cancelled) {
          setState('error')
        }
      }
    }

    setState('loading')
    void loadDocument()

    return () => {
      cancelled = true
      container?.replaceChildren()
    }
  }, [fetchUrl])

  if (state === 'error') {
    return <OfficePreviewFallback mimeType={WORD_MIME} variant="error" />
  }

  return (
    <div
      className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden"
      data-testid="docx-office-preview"
    >
      {state === 'loading' ? <OfficePreviewLoading /> : null}
      <div
        ref={containerRef}
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-auto rounded-md border border-border bg-background p-4',
          state === 'loading' && 'hidden',
        )}
      />
    </div>
  )
}
