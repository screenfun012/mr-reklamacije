import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  usersListOptions,
  type AuditLogFilters,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { DatePicker, FilterSelect, SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense, type ReactElement } from 'react'

import { useLocale } from '@mr/ui'

import { auditActionLabel, auditEntityTypeLabel } from './audit-labels'

const ALL_VALUE = '__all__'

/** The height and fill every control in this bar shares (`admFieldClassName` at filter size). */
const FILTER_CONTROL = 'h-10 rounded-[9px] border-mr-border-strong bg-adm-inbg text-[12.5px]'

export interface AuditLogFiltersBarProps {
  filters: AuditLogFilters
  onFiltersChange: (next: AuditLogFilters) => void
}

function ActorFilter({ filters, onFiltersChange }: AuditLogFiltersBarProps): ReactElement {
  const { data: users } = useSuspenseQuery(usersListOptions())

  return (
    <SearchableSelect
      value={filters.actorUserId ?? ''}
      options={users.map((user) => ({ value: user.id, label: user.name, keywords: user.email }))}
      placeholder={m.audit_filter_actor_all()}
      searchPlaceholder={m.field_search_placeholder()}
      emptyOptionLabel={m.audit_filter_actor_all()}
      noResultsLabel={m.field_no_results()}
      aria-label={m.audit_filter_actor_label()}
      className={`w-full sm:w-[16rem] ${FILTER_CONTROL}`}
      onValueChange={(value) =>
        onFiltersChange({ ...filters, actorUserId: value === '' ? undefined : value })
      }
    />
  )
}

export function AuditLogFiltersBar({
  filters,
  onFiltersChange,
}: AuditLogFiltersBarProps): ReactElement {
  // Subscribe to locale so the option labels below re-render on language switch.
  const { locale } = useLocale()
  void locale

  const entityOptions = [
    { value: ALL_VALUE, label: m.audit_filter_entity_all() },
    ...AUDIT_ENTITY_TYPES.map((type) => ({ value: type, label: auditEntityTypeLabel(type) })),
  ]

  const actionOptions = [
    { value: ALL_VALUE, label: m.audit_filter_action_all() },
    ...AUDIT_ACTIONS.map((action) => ({ value: action, label: auditActionLabel(action) })),
  ]

  const hasActiveFilter =
    filters.actorUserId !== undefined ||
    filters.entityType !== undefined ||
    filters.action !== undefined ||
    filters.dateFrom !== undefined ||
    filters.dateTo !== undefined

  return (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
      <Suspense fallback={<p className="text-sm text-muted-foreground">…</p>}>
        <ActorFilter filters={filters} onFiltersChange={onFiltersChange} />
      </Suspense>

      <FilterSelect
        value={filters.entityType ?? ALL_VALUE}
        options={entityOptions}
        placeholder={m.audit_filter_entity_all()}
        aria-label={m.audit_filter_entity_label()}
        className={`w-full sm:w-[14rem] ${FILTER_CONTROL}`}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, entityType: value === ALL_VALUE ? undefined : value })
        }
      />

      <FilterSelect
        value={filters.action ?? ALL_VALUE}
        options={actionOptions}
        placeholder={m.audit_filter_action_all()}
        aria-label={m.audit_filter_action_label()}
        className={`w-full sm:w-[14rem] ${FILTER_CONTROL}`}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            action: AUDIT_ACTIONS.find((candidate) => candidate === value),
          })
        }
      />

      <DatePicker
        value={filters.dateFrom}
        onChange={(value) => onFiltersChange({ ...filters, dateFrom: value })}
        placeholder={m.audit_filter_date_from()}
        aria-label={m.audit_filter_date_from()}
        className={`w-full sm:w-[11rem] ${FILTER_CONTROL}`}
      />

      <DatePicker
        value={filters.dateTo}
        onChange={(value) => onFiltersChange({ ...filters, dateTo: value })}
        placeholder={m.audit_filter_date_to()}
        aria-label={m.audit_filter_date_to()}
        className={`w-full sm:w-[11rem] ${FILTER_CONTROL}`}
      />

      {/* Only once something is filtered: an always-present "clear" on an unfiltered list is a
          control that does nothing, and this bar has five already. */}
      {hasActiveFilter ? (
        <button
          type="button"
          className="h-10 cursor-pointer px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onFiltersChange({})}
        >
          {m.audit_filter_clear()}
        </button>
      ) : null}
    </div>
  )
}
