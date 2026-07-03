import { useEffect, useRef, useState } from 'react'

import { m } from '@mr/i18n'
import { clientClaimReportPdfUrl, type ClaimKind } from '@mr/shared'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mr/ui'
import { Download } from 'lucide-react'

import { MaskedIcon } from '~/components/masked-icon'
import { PortalButton } from '~/components/portal-button'

type ViewerState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'

/**
 * "Download full report" card + in-app PDF viewer. The PDF is the SAME report
 * document authored in the internal app (shared claim-reports pipeline). Bytes
 * are fetched as a blob so 404/503 are handled in-app; the browser's native
 * PDF viewer in an <iframe> gives zoom/scroll/pages; the object URL is revoked
 * on close/unmount so no blob leaks.
 */
export function ReportDownloadCard({
  claimKind,
  claimId,
  fileName,
}: {
  claimKind: ClaimKind
  claimId: string
  fileName: string
}) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<ViewerState>('idle')
  const objectUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  const revoke = (): void => {
    if (objectUrlRef.current !== null) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  const abortPending = (): void => {
    abortRef.current?.abort()
    abortRef.current = null
  }

  useEffect(
    () => () => {
      abortPending()
      revoke()
    },
    [],
  )

  const handleOpenChange = (next: boolean): void => {
    setOpen(next)
    if (!next) {
      // Closing mid-load cancels the fetch — no orphaned blob URL.
      abortPending()
      revoke()
      setObjectUrl(null)
      setState('idle')
    }
  }

  const openReport = (): void => {
    setOpen(true)
    setState('loading')
    abortPending()
    const controller = new AbortController()
    abortRef.current = controller
    void (async () => {
      try {
        const response = await fetch(clientClaimReportPdfUrl(claimKind, claimId), {
          credentials: 'include',
          signal: controller.signal,
        })
        if (response.status === 404) {
          setState('unavailable')
          return
        }
        if (!response.ok) {
          setState('error')
          return
        }
        const blob = await response.blob()
        if (controller.signal.aborted) {
          return
        }
        revoke()
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setObjectUrl(url)
        setState('ready')
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState('error')
        }
      }
    })()
  }

  return (
    <>
      <div
        className="mrp-fade-up relative overflow-hidden rounded-[15px] border border-mrp-border bg-mrp-surface p-[26px]"
        style={{ animationDelay: '0.22s' }}
      >
        <span className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#ed1c24,transparent_70%)]" />
        <h2 className="mb-2 text-base font-extrabold">{m.portal_detail_download_title()}</h2>
        <p className="mb-5 text-[13.5px] leading-[1.55] text-mrp-text2">
          {m.portal_detail_download_subtitle()}
        </p>
        <PortalButton type="button" className="h-12 text-[13.5px]" onClick={openReport}>
          {m.portal_detail_download_button()}
        </PortalButton>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex h-[86vh] max-w-5xl flex-col gap-0 overflow-hidden border-mrp-border bg-mrp-surface p-0 text-mrp-text">
          <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-mrp-border px-5 py-3">
            <DialogTitle className="text-sm font-bold">
              {m.portal_report_viewer_title()}
            </DialogTitle>
            {state === 'ready' && objectUrl !== null ? (
              <a
                href={objectUrl}
                download={fileName}
                className="mr-8 inline-flex items-center gap-2 rounded-lg bg-mrp-btn px-3.5 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-mrp-btnfg transition-colors hover:bg-mrp-btnhv"
              >
                <Download className="size-4" aria-hidden="true" />
                {m.portal_report_download()}
              </a>
            ) : null}
          </DialogHeader>

          <div className="flex-1 overflow-hidden bg-mrp-raised">
            {state === 'loading' ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <MaskedIcon name="cog" spinning className="size-7 text-mrp-red" />
                <p className="text-sm text-mrp-text2">{m.portal_report_loading()}</p>
              </div>
            ) : null}
            {state === 'ready' && objectUrl !== null ? (
              <iframe
                src={objectUrl}
                title={m.portal_report_viewer_title()}
                className="size-full"
              />
            ) : null}
            {state === 'unavailable' ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <p className="text-sm text-mrp-text2">{m.portal_report_unavailable()}</p>
              </div>
            ) : null}
            {state === 'error' ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="text-sm text-mrp-text2">{m.portal_report_error()}</p>
                <button
                  type="button"
                  onClick={openReport}
                  className="cursor-pointer rounded-lg border border-mrp-border2 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] transition-colors hover:border-mrp-red hover:text-mrp-redh"
                >
                  {m.portal_report_retry()}
                </button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
