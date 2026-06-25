import { m } from '@mr/i18n'
import {
  CustomerCreateInputSchema,
  CustomerKind,
  CustomerUpdateInputSchema,
  ResourceChangedKey,
  customersReferenceOptions,
  type CustomerCreateInput,
  type CustomerListItem,
  type CustomerUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

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

export const customersResourceDefinition: ResourceDefinition<
  CustomerListItem,
  CustomerCreateInput,
  CustomerUpdateInput
> = {
  resourceKey: ResourceChangedKey.Customers,
  apiBase: '/api/customers',
  listQueryKeyPrefix: ['customers'],
  listQueryOptions: (filters) =>
    customersReferenceOptions({
      kind: CustomerKind.EmotivePartner,
      ...(filters ?? { activeOnly: false }),
    }) as unknown as ResourceListQueryOptions<CustomerListItem>,
  columns: [
    {
      id: 'name',
      header: () => m.field_name(),
      cell: (item) => item.name,
    },
    {
      id: 'country',
      header: () => m.field_country(),
      cell: (item) => displayNullableText(item.country),
    },
    {
      id: 'city',
      header: () => m.field_city(),
      cell: (item) => displayNullableText(item.city),
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
        item.isActive ? m.admin_customers_active_yes() : m.admin_customers_active_no(),
    },
  ],
  formFields: [
    {
      key: 'name',
      label: () => m.field_name(),
      type: 'text',
      required: true,
    },
    {
      key: 'country',
      label: () => m.field_country(),
      type: 'text',
    },
    {
      key: 'city',
      label: () => m.field_city(),
      type: 'text',
    },
  ],
  createSchema: CustomerCreateInputSchema as unknown as z.ZodType<CustomerCreateInput>,
  updateSchema: CustomerUpdateInputSchema as unknown as z.ZodType<CustomerUpdateInput>,
  title: () => m.admin_customers_title(),
  subtitle: () => m.admin_customers_subtitle(),
  addLabel: () => m.admin_customers_add(),
  emptyLabel: () => m.admin_customers_empty(),
  createTitle: () => m.admin_customers_create_title(),
  editTitle: () => m.admin_customers_edit_title(),
  createSuccessMessage: () => m.admin_customers_create_success(),
  updateSuccessMessage: () => m.admin_customers_update_success(),
  deactivateTitle: () => m.admin_customers_deactivate_title(),
  deactivateDescription: (item) => m.admin_customers_deactivate_description({ name: item.name }),
  deactivateConfirmLabel: () => m.admin_customers_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_customers_deactivate_success(),
  activeYesLabel: () => m.admin_customers_active_yes(),
  activeNoLabel: () => m.admin_customers_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    name: item?.name ?? '',
    country: item?.country ?? '',
    city: item?.city ?? '',
  }),
  buildCreateBody: (values) => ({
    name: (values['name'] ?? '').trim(),
    country: parseOptionalString(values['country'] ?? ''),
    city: parseOptionalString(values['city'] ?? ''),
  }),
  buildUpdateBody: (values) => ({
    name: parseOptionalString(values['name'] ?? ''),
    country: parseOptionalNullableString(values['country'] ?? ''),
    city: parseOptionalNullableString(values['city'] ?? ''),
  }),
  getDeactivateTargetLabel: (item) => item.name,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.name, item.country ?? '', item.city ?? ''].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_customers_reactivate_title(),
    reactivateDescription: (item) => m.admin_customers_reactivate_description({ name: item.name }),
    reactivateConfirmLabel: () => m.admin_customers_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_customers_reactivate_success(),
    hardDeleteTitle: () => m.admin_customers_hard_delete_title(),
    hardDeleteDescription: (item) => m.admin_customers_hard_delete_description({ name: item.name }),
    hardDeleteConfirmLabel: () => m.admin_customers_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_customers_hard_delete_success(),
    hardDeleteBlockedTooltip: (item) =>
      m.admin_customers_hard_delete_blocked({ name: item.name, count: item.usageCount }),
  },
}
