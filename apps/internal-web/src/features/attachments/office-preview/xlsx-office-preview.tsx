import { m } from '@mr/i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@mr/ui'
import { useEffect, useState } from 'react'

import { capSheetMatrix } from './cap-sheet-preview.js'
import { fetchAttachmentBuffer } from './fetch-attachment-buffer.js'
import {
  OFFICE_PREVIEW_MAX_COLS,
  OFFICE_PREVIEW_MAX_ROWS,
  SPREADSHEET_MIME,
} from './office-preview-constants.js'
import { OfficePreviewFallback } from './office-preview-fallback.js'
import { OfficePreviewLoading } from './office-preview-loading.js'

export interface XlsxOfficePreviewProps {
  fetchUrl: string
}

interface SheetPreviewData {
  readonly name: string
  readonly rows: readonly (readonly string[])[]
  readonly totalRows: number
  readonly truncated: boolean
}

interface ReadyState {
  readonly status: 'ready'
  readonly sheets: readonly SheetPreviewData[]
}

type LoadState = { status: 'loading' } | ReadyState | { status: 'error' }

export default function XlsxOfficePreview({
  fetchUrl,
}: XlsxOfficePreviewProps): React.ReactElement {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function loadWorkbook(): Promise<void> {
      try {
        const buffer = await fetchAttachmentBuffer(fetchUrl)
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(buffer, { type: 'array', dense: true })

        const sheets: SheetPreviewData[] = workbook.SheetNames.map((name) => {
          const worksheet = workbook.Sheets[name]
          if (worksheet === undefined) {
            return { name, rows: [], totalRows: 0, truncated: false }
          }

          const rawRows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
            worksheet,
            {
              header: 1,
              defval: '',
              raw: false,
            },
          )

          const capped = capSheetMatrix(rawRows, OFFICE_PREVIEW_MAX_ROWS, OFFICE_PREVIEW_MAX_COLS)

          return {
            name,
            rows: capped.rows,
            totalRows: capped.totalRows,
            truncated: capped.truncated,
          }
        })

        if (!cancelled) {
          setState({ status: 'ready', sheets })
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error' })
        }
      }
    }

    void loadWorkbook()

    return () => {
      cancelled = true
    }
  }, [fetchUrl])

  if (state.status === 'loading') {
    return <OfficePreviewLoading />
  }

  if (state.status === 'error') {
    return <OfficePreviewFallback mimeType={SPREADSHEET_MIME} variant="error" />
  }

  if (state.sheets.length === 0) {
    return <OfficePreviewFallback mimeType={SPREADSHEET_MIME} variant="error" />
  }

  const defaultSheetName = state.sheets[0]?.name

  if (defaultSheetName === undefined) {
    return <OfficePreviewFallback mimeType={SPREADSHEET_MIME} variant="error" />
  }

  return (
    <div
      className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col gap-3"
      data-testid="xlsx-office-preview"
    >
      <Tabs
        defaultValue={defaultSheetName}
        className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col"
      >
        <TabsList className="w-full shrink-0 overflow-x-auto">
          {state.sheets.map((sheet) => (
            <TabsTrigger key={sheet.name} value={sheet.name}>
              {sheet.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {state.sheets.map((sheet) => (
          <TabsContent
            key={sheet.name}
            value={sheet.name}
            className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            {sheet.truncated ? (
              <p className="mb-2 shrink-0 text-xs text-muted-foreground">
                {m.claim_attachments_office_row_cap({
                  shownRows: String(sheet.rows.length),
                  totalRows: String(sheet.totalRows),
                })}
              </p>
            ) : null}

            <div className="min-h-0 min-w-0 w-full flex-1 overflow-x-auto overflow-y-auto rounded-md border border-border bg-background">
              <table className="w-max min-w-full border-collapse text-left text-sm">
                <tbody>
                  {sheet.rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-2 text-muted-foreground">
                        {m.claim_attachments_empty()}
                      </td>
                    </tr>
                  ) : (
                    sheet.rows.map((row, rowIndex) => (
                      <tr key={`${sheet.name}-${rowIndex}`} className="border-b border-border/60">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${sheet.name}-${rowIndex}-${cellIndex}`}
                            className="px-3 py-1.5 align-top whitespace-nowrap"
                            title={cell}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
