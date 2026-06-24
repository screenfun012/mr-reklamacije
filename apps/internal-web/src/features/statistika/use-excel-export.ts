import type { ExcelExportInput } from '@mr/shared'
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

export interface UseExcelExportResult {
  exportWorkbook: (input: ExcelExportInput) => Promise<void>
  isExporting: boolean
}

export function useExcelExport(): UseExcelExportResult {
  const [isExporting, setIsExporting] = useState(false)

  const exportWorkbook = useCallback(async (input: ExcelExportInput) => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/excel/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (response.status === 403) {
        toast.error(m.statistika_export_forbidden())
        return
      }

      if (!response.ok) {
        toast.error(m.statistika_export_error())
        return
      }

      const blob = await response.blob()
      const fileName = parseDownloadFileName(
        response.headers.get('Content-Disposition'),
        'reklamacije.xlsx',
      )
      triggerBrowserDownload(blob, fileName)
      toast.success(m.statistika_export_success())
    } catch {
      toast.error(m.statistika_export_error())
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { exportWorkbook, isExporting }
}
