import { m } from '@mr/i18n'

import { renderActiveCell } from '~/lib/resource/resource-active-cell'
import {
  ClaimSourceCreateInputSchema,
  ClaimSourceUpdateInputSchema,
  ResourceChangedKey,
  claimSourcesReferenceOptions,
  type ClaimSourceCreateInput,
  type ClaimSourceListItem,
  type ClaimSourceUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

function parseOptionalString(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function parseOptionalNullableString(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  // Strict full-string parse: a separated value like "1.998" / "1,998" / "1 998" is
  // REJECTED (undefined), not silently truncated to 1 the way Number.parseInt would.
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) ? parsed : undefined
}

function displayNullableText(value: string | null): string {
  return value ?? '—'
}

export const claimSourcesResourceDefinition: ResourceDefinition<
  ClaimSourceListItem,
  ClaimSourceCreateInput,
  ClaimSourceUpdateInput
> = {
  resourceKey: ResourceChangedKey.ClaimSources,
  apiBase: '/api/claim-sources',
  listQueryKeyPrefix: ['claim-sources'],
  listQueryOptions: (filters) =>
    claimSourcesReferenceOptions(
      filters ?? { activeOnly: false },
    ) as unknown as ResourceListQueryOptions<ClaimSourceListItem>,
  columns: [
    {
      id: 'code',
      header: () => m.field_code(),
      cell: (item) => item.code,
    },
    {
      id: 'name',
      header: () => m.field_name(),
      cell: (item) => item.name,
    },
    {
      id: 'defaultCustomer',
      header: () => m.field_default_customer(),
      cell: (item) => item.defaultCustomer?.name ?? '—',
    },
    {
      id: 'claimNumberPrefix',
      header: () => m.field_claim_number_prefix(),
      cell: (item) => displayNullableText(item.claimNumberPrefix),
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
        renderActiveCell(
          item.isActive,
          item.isActive ? m.admin_claim_sources_active_yes() : m.admin_claim_sources_active_no(),
        ),
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
      key: 'name',
      label: () => m.field_name(),
      type: 'text',
      required: true,
    },
    {
      key: 'claimNumberPrefix',
      label: () => m.field_claim_number_prefix(),
      type: 'text',
    },
    {
      key: 'defaultCustomerId',
      label: () => m.field_default_customer(),
      type: 'reference-select',
      referenceKey: 'customers',
    },
    {
      key: 'sortOrder',
      label: () => m.field_sort_order(),
      type: 'number',
    },
  ],
  createSchema: ClaimSourceCreateInputSchema as unknown as z.ZodType<ClaimSourceCreateInput>,
  updateSchema: ClaimSourceUpdateInputSchema as unknown as z.ZodType<ClaimSourceUpdateInput>,
  title: () => m.admin_claim_sources_title(),
  subtitle: () => m.admin_claim_sources_subtitle(),
  addLabel: () => m.admin_claim_sources_add(),
  emptyLabel: () => m.admin_claim_sources_empty(),
  createTitle: () => m.admin_claim_sources_create_title(),
  editTitle: () => m.admin_claim_sources_edit_title(),
  createSuccessMessage: () => m.admin_claim_sources_create_success(),
  updateSuccessMessage: () => m.admin_claim_sources_update_success(),
  deactivateTitle: () => m.admin_claim_sources_deactivate_title(),
  deactivateDescription: (item) =>
    m.admin_claim_sources_deactivate_description({ name: item.name }),
  deactivateConfirmLabel: () => m.admin_claim_sources_deactivate_confirm(),
  deactivateSuccessMessage: () => m.admin_claim_sources_deactivate_success(),
  activeYesLabel: () => m.admin_claim_sources_active_yes(),
  activeNoLabel: () => m.admin_claim_sources_active_no(),
  editActionLabel: () => m.action_edit(),
  getInitialFormValues: (item) => ({
    code: item?.code ?? '',
    name: item?.name ?? '',
    claimNumberPrefix: item?.claimNumberPrefix ?? '',
    defaultCustomerId: item?.defaultCustomerId ?? '',
    sortOrder: item?.sortOrder !== undefined ? String(item.sortOrder) : '',
  }),
  buildCreateBody: (values) => ({
    code: (values['code'] ?? '').trim(),
    name: (values['name'] ?? '').trim(),
    claimNumberPrefix: parseOptionalString(values['claimNumberPrefix'] ?? ''),
    defaultCustomerId: parseOptionalString(values['defaultCustomerId'] ?? ''),
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
  }),
  buildUpdateBody: (values) => ({
    name: (values['name'] ?? '').trim(),
    claimNumberPrefix: parseOptionalNullableString(values['claimNumberPrefix'] ?? ''),
    defaultCustomerId: parseOptionalNullableString(values['defaultCustomerId'] ?? ''),
    sortOrder: parseOptionalInt(values['sortOrder'] ?? ''),
  }),
  getDeactivateTargetLabel: (item) => item.name,
  listConfig: {
    defaultPageSize: 25,
    getSearchableText: (item) => [item.code, item.name, item.defaultCustomer?.name ?? ''].join(' '),
  },
  lifecycle: {
    getUsageCount: (item) => item.usageCount,
    reactivateTitle: () => m.admin_claim_sources_reactivate_title(),
    reactivateDescription: (item) =>
      m.admin_claim_sources_reactivate_description({ name: item.name }),
    reactivateConfirmLabel: () => m.admin_claim_sources_reactivate_confirm(),
    reactivateSuccessMessage: () => m.admin_claim_sources_reactivate_success(),
    hardDeleteTitle: () => m.admin_claim_sources_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.admin_claim_sources_hard_delete_description({ name: item.name }),
    hardDeleteConfirmLabel: () => m.admin_claim_sources_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.admin_claim_sources_hard_delete_success(),
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
