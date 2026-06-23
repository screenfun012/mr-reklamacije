import type { ClaimKind } from '@mr/shared'
import { m } from '@mr/i18n'
import { toast } from '@mr/ui'
import { useCallback, useState } from 'react'

function parseDownloadFileName(contentDisposition: string | null, fallback: string): string {
  if (contentDisposition === null) {
    return fallback
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1] !== undefined) {
    return decodeURIComponent(utfMatch[1])
  }

  const plainMatch = contentDisposition.match(/filename="([^"]+)"/i)
  return plainMatch?.[1] ?? fallback
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

export interface UseClaimReportExportResult {
  exportPdf: () => Promise<void>
  exportDocx: () => Promise<void>
  isExportingPdf: boolean
  isExportingDocx: boolean
}

export function useClaimReportExport(
  claimKind: ClaimKind,
  claimId: string,
): UseClaimReportExportResult {
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingDocx, setIsExportingDocx] = useState(false)

  const buildExportUrl = useCallback(
    (format: 'pdf' | 'docx') =>
      `/api/claim-reports/export/${format}?claimKind=${encodeURIComponent(claimKind)}&claimId=${encodeURIComponent(claimId)}`,
    [claimId, claimKind],
  )

  const exportDocx = useCallback(async () => {
    setIsExportingDocx(true)
    try {
      const response = await fetch(buildExportUrl('docx'))
      if (!response.ok) {
        toast.error(m.claim_report_export_error())
        return
      }

      const blob = await response.blob()
      const fileName = parseDownloadFileName(
        response.headers.get('Content-Disposition'),
        `izvestaj-${claimId}.docx`,
      )
      triggerBrowserDownload(blob, fileName)
    } catch {
      toast.error(m.claim_report_export_error())
    } finally {
      setIsExportingDocx(false)
    }
  }, [buildExportUrl, claimId])

  const exportPdf = useCallback(async () => {
    setIsExportingPdf(true)
    try {
      const response = await fetch(buildExportUrl('pdf'))
      if (response.status === 503) {
        toast.message(m.claim_report_pdf_unavailable_print_hint())
        window.print()
        return
      }

      if (!response.ok) {
        toast.error(m.claim_report_export_error())
        return
      }

      const blob = await response.blob()
      const fileName = parseDownloadFileName(
        response.headers.get('Content-Disposition'),
        `izvestaj-${claimId}.pdf`,
      )
      triggerBrowserDownload(blob, fileName)
    } catch {
      toast.error(m.claim_report_export_error())
    } finally {
      setIsExportingPdf(false)
    }
  }, [buildExportUrl, claimId])

  return {
    exportPdf,
    exportDocx,
    isExportingPdf,
    isExportingDocx,
  }
}
