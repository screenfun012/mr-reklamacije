import {
  ExcelExportInputSchema,
  ExcelExportScope,
  OUTCOME_REGISTRY,
  type ExcelExportInput,
  type OutcomeLabelKey,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, DatePicker, FilterSelect, Input } from '@mr/ui'
import { Download, Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { FILTER_ALL_SENTINEL } from '~/features/filters/filter-sentinel'
import { useLocale } from '~/lib/locale'

import { useExcelExport } from './use-excel-export'

const OUTCOME_LABELS: Record<OutcomeLabelKey, () => string> = {
  outcome_pending: () => m.outcome_pending(),
  outcome_accepted: () => m.outcome_accepted(),
  outcome_rejected: () => m.outcome_rejected(),
  outcome_archived: () => m.outcome_archived(),
}

export interface StatistikaExportSectionProps {
  canExportPartial: boolean
  canExportFull: boolean
}

export function StatistikaExportSection({
  canExportPartial,
  canExportFull,
}: StatistikaExportSectionProps): React.ReactElement {
  useLocale()
  const { exportWorkbook, isExporting } = useExcelExport()
  const [scope, setScope] = useState<ExcelExportInput['scope']>(ExcelExportScope.All)
  const [claimYear, setClaimYear] = useState('')
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined)
  const [dateTo, setDateTo] = useState<string | undefined>(undefined)
  const [outcome, setOutcome] = useState<string>(FILTER_ALL_SENTINEL)

  const scopeOptions = useMemo(
    () => [
      { value: ExcelExportScope.All, label: m.statistika_export_scope_all() },
      { value: ExcelExportScope.Emotive, label: m.statistika_export_scope_emotive() },
      { value: ExcelExportScope.Domace, label: m.statistika_export_scope_domace() },
    ],
    [],
  )

  const outcomeOptions = useMemo(
    () => [
      { value: FILTER_ALL_SENTINEL, label: m.emotive_claims_filter_outcome_all() },
      ...OUTCOME_REGISTRY.map((definition) => ({
        value: definition.key,
        label: OUTCOME_LABELS[definition.labelKey](),
      })),
    ],
    [],
  )

  const isFullExport = useMemo(() => {
    const parsedYear = claimYear.trim().length > 0 ? Number(claimYear) : undefined
    return (
      scope === ExcelExportScope.All &&
      parsedYear === undefined &&
      dateFrom === undefined &&
      dateTo === undefined &&
      outcome === FILTER_ALL_SENTINEL
    )
  }, [claimYear, dateFrom, dateTo, outcome, scope])

  const exportBlocked = isFullExport ? !canExportFull : !canExportPartial

  const handleExport = useCallback(async () => {
    const parsedYear = claimYear.trim().length > 0 ? Number(claimYear) : undefined
    const input = ExcelExportInputSchema.parse({
      scope,
      claimYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
      dateFrom: dateFrom !== undefined ? `${dateFrom}T00:00:00.000Z` : undefined,
      dateTo: dateTo !== undefined ? `${dateTo}T00:00:00.000Z` : undefined,
      outcome: outcome === FILTER_ALL_SENTINEL ? undefined : outcome,
    })

    await exportWorkbook(input)
  }, [claimYear, dateFrom, dateTo, exportWorkbook, outcome, scope])

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{m.statistika_export_title()}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{m.statistika_export_description()}</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterSelect
          label={m.statistika_export_scope()}
          value={scope}
          options={scopeOptions}
          placeholder={m.statistika_export_scope_all()}
          aria-label={m.statistika_export_scope()}
          onValueChange={(value) => {
            setScope(value as ExcelExportInput['scope'])
          }}
        />

        <div className="flex min-w-[8rem] flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">{m.statistika_export_year()}</span>
          <Input
            inputMode="numeric"
            placeholder={m.statistika_export_year_placeholder()}
            value={claimYear}
            onChange={(event) => {
              setClaimYear(event.target.value)
            }}
            aria-label={m.statistika_export_year()}
          />
        </div>

        <div className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">{m.emotive_claims_filter_date_from()}</span>
          <DatePicker
            value={dateFrom}
            onChange={setDateFrom}
            aria-label={m.emotive_claims_filter_date_from()}
          />
        </div>

        <div className="flex min-w-[10rem] flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">{m.emotive_claims_filter_date_to()}</span>
          <DatePicker
            value={dateTo}
            onChange={setDateTo}
            aria-label={m.emotive_claims_filter_date_to()}
          />
        </div>

        <FilterSelect
          label={m.emotive_claims_filter_outcome()}
          value={outcome}
          options={outcomeOptions}
          placeholder={m.emotive_claims_filter_outcome_all()}
          aria-label={m.emotive_claims_filter_outcome()}
          onValueChange={setOutcome}
        />

        <Button
          type="button"
          disabled={isExporting || exportBlocked}
          onClick={() => {
            void handleExport()
          }}
        >
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {isExporting ? m.statistika_export_pending() : m.statistika_export_button()}
        </Button>
      </div>

      {exportBlocked ? (
        <p className="text-sm text-muted-foreground">{m.statistika_export_permission_hint()}</p>
      ) : null}
    </section>
  )
}
