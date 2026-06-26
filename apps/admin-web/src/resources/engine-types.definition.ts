import { m } from '@mr/i18n'
import {
  EngineTypeCreateInputSchema,
  EngineTypeUpdateInputSchema,
  ResourceChangedKey,
  engineTypesReferenceOptions,
  type EngineTypeCreateInput,
  type EngineTypeListItem,
  type EngineTypeUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function parseOptionalNullableInt(value: string): number | null | undefined {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function parseOptionalString(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function parseOptionalNullableString(value: string): string | null | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function displayNullableText(value: string | null): string {
  return value ?? '—'
}

function displayNullableNumber(value: number | null): string {
  return value === null ? '—' : String(value)
}

export const engineTypesResourceDefinition: ResourceDefinition<
  EngineTypeListItem,
  EngineTypeCreateInput,
  EngineTypeUpdateInput
> = {
  resourceKey: ResourceChangedKey.EngineTypes,
  apiBase: '/api/engine-types',
  listQueryKeyPrefix: ['engine-types'],
  listQueryOptions: (filters) =>
    engineTypesReferenceOptions(
      filters ?? { activeOnly: false },
    ) as unknown as ResourceListQueryOptions<EngineTypeListItem>,
  columns: [
    {
      id: 'code',
      header: () => m.admin_engine_types_col_code(),
      cell: (item) => item.code,
    },
    {
      id: 'manufacturer',
      header: () => m.field_manufacturer(),
      cell: (item) => displayNullableText(item.manufacturer),
    },
    {
      id: 'displacementCc',
      header: () => m.field_displacement_cc(),
      cell: (item) => displayNullableNumber(item.displacementCc),
      cellClassName: 'tabular-nums',
    },
    {
      id: 'usageCount',
      header: () => m.field_usage_count(),
      cell: (item) => String(item.usageCount),
      cellClassName: 'tabular-nums',
    },
    {
      id: 'isActive',
      header: () => m.field_active(),
      cell: (item) =>
        item.isActive ? m.admin_engine_types_active_yes() : m.admin_engine_types_active_no(),
    },
  ],
  formFields: [
    {
      key: 'code',
      label: () => m.field_code(),
      type: 'text',
      createOnly: true,
      required: true,
    },
    {
      key: 'code',
      label: () => m.field_code(),
      type: 'readonly',
      editOnly: true,
    },
    {
      key: 'manufacturer',
      label: () => m.field_manufacturer(),
      type: 'text',
    },
    {
      key: 'displacementCc',
      label: () => m.field_displacement_cc(),
      type: 'number',
    },
    {
      key: 'notes',
      label: () => m.field_notes(),
      type: 'textarea',
    },
  ],
  createSchema: EngineTypeCreateInputSchema as unknown as z.ZodType<EngineTypeCreateInput>,
  updateSchema: EngineTypeUpdateInputSchema as unknown as z.ZodType<EngineTypeUpdateInput>,
  title: () => m.admin_engine_types_title(),
  subtitle: () => m.admin_engine_types_subtitle(),
  addLabel: () => m.admin_engine_types_add(),
  emptyLabel: () => m.admin_engine_types_empty(),
  createTitle: () => m.admin_engine_types_create_title(),
  editTitle: () => m.admin_engine_types_edit_title(),
  createSuccessMessage: () => m.admin_engine_types_create_success(),
  updateSuccessMessage: () => m.admin_engine_types_update_success(),
  deactivateTitle: () => m.admin_engine_types_deactivate_title(),
  deactivateDescription: (item) => m.admin_engine_types_deactivate_description({ code: item.code }),
  deactivateConfirmLabel: () => m.admin_engine_types_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_engine_types_deactivate_success(),
  activeYesLabel: () => m.admin_engine_types_active_yes(),
  activeNoLabel: () => m.admin_engine_types_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    code: item?.code ?? '',
    manufacturer: item?.manufacturer ?? '',
    displacementCc: item?.displacementCc === null ? '' : String(item?.displacementCc ?? ''),
    notes: item?.notes ?? '',
  }),
  buildCreateBody: (values) => ({
    code: (values['code'] ?? '').trim(),
    manufacturer: parseOptionalString(values['manufacturer'] ?? ''),
    displacementCc: parseOptionalInt(values['displacementCc'] ?? ''),
    notes: parseOptionalString(values['notes'] ?? ''),
  }),
  buildUpdateBody: (values) => ({
    manufacturer: parseOptionalNullableString(values['manufacturer'] ?? ''),
    displacementCc: parseOptionalNullableInt(values['displacementCc'] ?? ''),
    notes: parseOptionalNullableString(values['notes'] ?? ''),
  }),
  getDeactivateTargetLabel: (item) => item.code,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.code, item.manufacturer ?? ''].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_engine_types_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_engine_types_reactivate_description({ code: item.code }),
    reactivateConfirmLabel: () => m.admin_engine_types_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_engine_types_reactivate_success(),
    hardDeleteTitle: () => m.admin_engine_types_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_engine_types_hard_delete_description({ code: item.code }),
    hardDeleteConfirmLabel: () => m.admin_engine_types_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_engine_types_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
