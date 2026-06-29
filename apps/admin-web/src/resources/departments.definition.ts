import { m } from '@mr/i18n'
import {
  DepartmentCreateInputSchema,
  DepartmentUpdateInputSchema,
  ResourceChangedKey,
  departmentsReferenceOptions,
  type DepartmentCreateInput,
  type DepartmentListItem,
  type DepartmentUpdateInput,
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

export const departmentsResourceDefinition: ResourceDefinition<
  DepartmentListItem,
  DepartmentCreateInput,
  DepartmentUpdateInput
> = {
  resourceKey: ResourceChangedKey.Departments,
  apiBase: '/api/departments',
  listQueryKeyPrefix: ['departments'],
  listQueryOptions: (filters) =>
    departmentsReferenceOptions(
      filters ?? { activeOnly: false },
    ) as unknown as ResourceListQueryOptions<DepartmentListItem>,
  columns: [
    {
      id: 'code',
      header: () => m.field_code(),
      cell: (item) => item.code,
    },
    {
      id: 'nameSr',
      header: () => m.field_name_sr(),
      cell: (item) => item.nameSr,
    },
    {
      id: 'nameEn',
      header: () => m.field_name_en(),
      cell: (item) => item.nameEn,
    },
    {
      id: 'sortOrder',
      header: () => m.field_sort_order(),
      cell: (item) => String(item.sortOrder),
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
        item.isActive ? m.admin_departments_active_yes() : m.admin_departments_active_no(),
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
      key: 'nameSr',
      label: () => m.field_name_sr(),
      type: 'text',
      required: true,
    },
    {
      key: 'nameEn',
      label: () => m.field_name_en(),
      type: 'text',
      required: true,
    },
    {
      key: 'sortOrder',
      label: () => m.field_sort_order(),
      type: 'number',
    },
  ],
  createSchema: DepartmentCreateInputSchema as unknown as z.ZodType<DepartmentCreateInput>,
  updateSchema: DepartmentUpdateInputSchema as unknown as z.ZodType<DepartmentUpdateInput>,
  title: () => m.admin_departments_title(),
  subtitle: () => m.admin_departments_subtitle(),
  addLabel: () => m.admin_departments_add(),
  emptyLabel: () => m.admin_departments_empty(),
  createTitle: () => m.admin_departments_create_title(),
  editTitle: () => m.admin_departments_edit_title(),
  createSuccessMessage: () => m.admin_departments_create_success(),
  updateSuccessMessage: () => m.admin_departments_update_success(),
  deactivateTitle: () => m.admin_departments_deactivate_title(),
  deactivateDescription: (item) =>
    m.admin_departments_deactivate_description({ name: item.nameSr }),
  deactivateConfirmLabel: () => m.admin_departments_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_departments_deactivate_success(),
  activeYesLabel: () => m.admin_departments_active_yes(),
  activeNoLabel: () => m.admin_departments_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    code: item?.code ?? '',
    nameSr: item?.nameSr ?? '',
    nameEn: item?.nameEn ?? '',
    sortOrder: item?.sortOrder !== undefined ? String(item.sortOrder) : '',
  }),
  buildCreateBody: (values) => ({
    code: (values['code'] ?? '').trim(),
    nameSr: (values['nameSr'] ?? '').trim(),
    nameEn: (values['nameEn'] ?? '').trim(),
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
  }),
  buildUpdateBody: (values) => ({
    nameSr: (values['nameSr'] ?? '').trim(),
    nameEn: (values['nameEn'] ?? '').trim(),
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
  }),
  getDeactivateTargetLabel: (item) => item.nameSr,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.code, item.nameSr, item.nameEn].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_departments_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_departments_reactivate_description({ name: item.nameSr }),
    reactivateConfirmLabel: () => m.admin_departments_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_departments_reactivate_success(),
    hardDeleteTitle: () => m.admin_departments_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_departments_hard_delete_description({ name: item.nameSr }),
    hardDeleteConfirmLabel: () => m.admin_departments_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_departments_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
