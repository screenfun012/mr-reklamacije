import { m } from '@mr/i18n'

import { renderActiveCell } from '~/lib/resource/resource-active-cell'
import {
  EmployeeCreateInputSchema,
  EmployeeUpdateInputSchema,
  ResourceChangedKey,
  employeesReferenceOptions,
  type EmployeeCreateInput,
  type EmployeeListItem,
  type EmployeeUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

const EMPTY = '—'

function departmentIdOrNull(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

export const employeesResourceDefinition: ResourceDefinition<
  EmployeeListItem,
  EmployeeCreateInput,
  EmployeeUpdateInput
> = {
  resourceKey: ResourceChangedKey.Employees,
  apiBase: '/api/employees',
  listQueryKeyPrefix: ['employees'],
  listQueryOptions: (filters) =>
    employeesReferenceOptions(
      filters ?? { activeOnly: false },
    ) as unknown as ResourceListQueryOptions<EmployeeListItem>,
  columns: [
    {
      id: 'fullName',
      header: () => m.field_full_name(),
      cell: (item) => item.fullName,
    },
    {
      id: 'departmentName',
      header: () => m.field_department(),
      cell: (item) => item.departmentName ?? EMPTY,
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
        renderActiveCell(
          item.isActive,
          item.isActive ? m.admin_employees_active_yes() : m.admin_employees_active_no(),
        ),
    },
  ],
  formFields: [
    {
      key: 'fullName',
      label: () => m.field_full_name(),
      type: 'text',
      required: true,
    },
    {
      key: 'departmentId',
      label: () => m.field_department(),
      type: 'reference-select',
      referenceKey: 'departments',
    },
  ],
  createSchema: EmployeeCreateInputSchema as unknown as z.ZodType<EmployeeCreateInput>,
  updateSchema: EmployeeUpdateInputSchema as unknown as z.ZodType<EmployeeUpdateInput>,
  title: () => m.admin_employees_title(),
  subtitle: () => m.admin_employees_subtitle(),
  addLabel: () => m.admin_employees_add(),
  emptyLabel: () => m.admin_employees_empty(),
  createTitle: () => m.admin_employees_create_title(),
  editTitle: () => m.admin_employees_edit_title(),
  createSuccessMessage: () => m.admin_employees_create_success(),
  updateSuccessMessage: () => m.admin_employees_update_success(),
  deactivateTitle: () => m.admin_employees_deactivate_title(),
  deactivateDescription: (item) =>
    m.admin_employees_deactivate_description({ name: item.fullName }),
  deactivateConfirmLabel: () => m.admin_employees_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_employees_deactivate_success(),
  activeYesLabel: () => m.admin_employees_active_yes(),
  activeNoLabel: () => m.admin_employees_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    fullName: item?.fullName ?? '',
    departmentId: item?.departmentId ?? '',
  }),
  buildCreateBody: (values) => ({
    fullName: (values['fullName'] ?? '').trim(),
    departmentId: departmentIdOrNull(values['departmentId']),
  }),
  buildUpdateBody: (values) => ({
    fullName: (values['fullName'] ?? '').trim(),
    departmentId: departmentIdOrNull(values['departmentId']),
  }),
  getDeactivateTargetLabel: (item) => item.fullName,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.fullName, item.departmentName ?? ''].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_employees_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_employees_reactivate_description({ name: item.fullName }),
    reactivateConfirmLabel: () => m.admin_employees_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_employees_reactivate_success(),
    hardDeleteTitle: () => m.admin_employees_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_employees_hard_delete_description({ name: item.fullName }),
    hardDeleteConfirmLabel: () => m.admin_employees_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_employees_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
