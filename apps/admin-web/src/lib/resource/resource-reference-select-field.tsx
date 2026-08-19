import { m } from '@mr/i18n'
import { SearchableSelect } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'

import { admLabelClassName } from '../adm-chrome.js'
import { getReferenceSelectConfig } from './reference-select-registry.js'
import type { ResourceReferenceSelectFieldDef } from './types.js'

interface ResourceReferenceSelectFieldProps {
  field: ResourceReferenceSelectFieldDef
  fieldId: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}

export function ResourceReferenceSelectField({
  field,
  fieldId,
  value,
  disabled,
  onChange,
}: ResourceReferenceSelectFieldProps): React.ReactElement {
  const config = getReferenceSelectConfig(field.referenceKey)
  const { data } = useSuspenseQuery(config.queryOptions())

  return (
    <div className="space-y-1.5">
      <label className={admLabelClassName} htmlFor={fieldId}>
        {field.label()}
      </label>
      <SearchableSelect
        id={fieldId}
        // The one control here that stays a `@mr/ui` component — it carries search, keyboard
        // handling and a popover, none of which a bare `<select>` has. Only its height is pulled up
        // to the 44px the fields beside it use.
        className="h-11 rounded-[9px]"
        value={value}
        options={config.toOptions(data)}
        placeholder={m.emotive_claims_create_select_placeholder()}
        searchPlaceholder={m.field_search_placeholder()}
        emptyOptionLabel={m.emotive_claims_create_select_placeholder()}
        noResultsLabel={m.field_no_results()}
        disabled={disabled}
        onValueChange={onChange}
      />
    </div>
  )
}
