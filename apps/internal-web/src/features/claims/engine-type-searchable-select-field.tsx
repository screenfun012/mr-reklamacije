import { engineTypesReferenceOptions } from '@mr/shared'
import { m } from '@mr/i18n'
import { SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense } from 'react'

import {
  buildEngineTypeSearchableOptions,
  isOrphanOnlyEngineTypeSelection,
  type EngineTypeOrphanOption,
} from './engine-type-options.js'

interface EngineTypeSearchableSelectFieldProps {
  id: string
  value: string
  className?: string | undefined
  manufacturerId: string
  disabled: boolean
  orphanEngineType?: EngineTypeOrphanOption | undefined
  onValueChange: (value: string) => void
  onBlur?: (() => void) | undefined
  'aria-label': string
}

function OrphanOnlyEngineTypeSelect({
  id,
  value,
  className,
  disabled,
  orphanEngineType,
  onValueChange,
  onBlur,
  'aria-label': ariaLabel,
}: EngineTypeSearchableSelectFieldProps): React.ReactElement {
  return (
    <SearchableSelect
      id={id}
      value={value}
      className={className}
      options={buildEngineTypeSearchableOptions([], value, orphanEngineType)}
      placeholder={m.emotive_claims_create_select_placeholder()}
      searchPlaceholder={m.field_search_placeholder()}
      emptyOptionLabel={m.emotive_claims_create_select_placeholder()}
      noResultsLabel={m.field_no_results()}
      disabled={disabled}
      aria-label={ariaLabel}
      onValueChange={onValueChange}
      {...(onBlur !== undefined ? { onBlur } : {})}
    />
  )
}

function EngineTypeSearchableSelectLoaded({
  id,
  value,
  className,
  manufacturerId,
  disabled,
  orphanEngineType,
  onValueChange,
  onBlur,
  'aria-label': ariaLabel,
}: EngineTypeSearchableSelectFieldProps): React.ReactElement {
  const { data } = useSuspenseQuery(
    engineTypesReferenceOptions({ activeOnly: true, manufacturerId }),
  )

  return (
    <SearchableSelect
      id={id}
      value={value}
      className={className}
      options={buildEngineTypeSearchableOptions(data, value, orphanEngineType)}
      placeholder={m.emotive_claims_create_select_placeholder()}
      searchPlaceholder={m.field_search_placeholder()}
      emptyOptionLabel={m.emotive_claims_create_select_placeholder()}
      noResultsLabel={m.field_no_results()}
      disabled={disabled}
      aria-label={ariaLabel}
      onValueChange={onValueChange}
      {...(onBlur !== undefined ? { onBlur } : {})}
    />
  )
}

export function EngineTypeSearchableSelectField(
  props: EngineTypeSearchableSelectFieldProps,
): React.ReactElement {
  if (isOrphanOnlyEngineTypeSelection(props.manufacturerId, props.value, props.orphanEngineType)) {
    return <OrphanOnlyEngineTypeSelect {...props} />
  }

  if (props.manufacturerId.trim() === '') {
    return (
      <SearchableSelect
        id={props.id}
        value=""
        className={props.className}
        options={[]}
        placeholder={m.field_select_manufacturer_first()}
        searchPlaceholder={m.field_search_placeholder()}
        noResultsLabel={m.field_no_results()}
        disabled
        aria-label={props['aria-label']}
        onValueChange={() => undefined}
      />
    )
  }

  return (
    <Suspense
      fallback={
        <SearchableSelect
          id={props.id}
          value={props.value}
          className={props.className}
          options={[]}
          placeholder={m.emotive_claims_create_select_placeholder()}
          searchPlaceholder={m.field_search_placeholder()}
          noResultsLabel={m.field_no_results()}
          disabled
          aria-label={props['aria-label']}
          onValueChange={() => undefined}
        />
      }
    >
      <EngineTypeSearchableSelectLoaded {...props} />
    </Suspense>
  )
}
