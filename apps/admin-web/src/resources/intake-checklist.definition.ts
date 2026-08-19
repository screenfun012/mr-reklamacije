import { m } from '@mr/i18n'

import { renderActiveCell } from '~/lib/resource/resource-active-cell'
import {
  IntakeChecklistItemCreateInputSchema,
  IntakeChecklistItemUpdateInputSchema,
  ResourceChangedKey,
  intakeChecklistItemsReferenceOptions,
  type IntakeChecklistItemCreateInput,
  type IntakeChecklistItemListItem,
  type IntakeChecklistItemUpdateInput,
} from '@mr/shared'
import type { z } from 'zod'

import type { ResourceDefinition, ResourceListQueryOptions } from '~/lib/resource/types.js'

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

export const intakeChecklistResourceDefinition: ResourceDefinition<
  IntakeChecklistItemListItem,
  IntakeChecklistItemCreateInput,
  IntakeChecklistItemUpdateInput
> = {
  resourceKey: ResourceChangedKey.IntakeChecklistItems,
  apiBase: '/api/intake-checklist-items',
  // Same first segment the reference/display query factories key under, so the existing
  // SSE prefix invalidation for IntakeChecklistItems covers this screen's list too.
  listQueryKeyPrefix: ['intake-checklist-items'],
  listQueryOptions: (filters) =>
    intakeChecklistItemsReferenceOptions(
      filters ?? { activeOnly: false },
    ) as unknown as ResourceListQueryOptions<IntakeChecklistItemListItem>,
  columns: [
    {
      id: 'code',
      header: () => m.intake_checklist_field_code(),
      cell: (item) => item.code,
      cellClassName: 'font-mono',
    },
    {
      id: 'nameSr',
      header: () => m.intake_checklist_field_name_sr(),
      cell: (item) => item.nameSr,
    },
    {
      id: 'nameEn',
      header: () => m.intake_checklist_field_name_en(),
      cell: (item) => item.nameEn,
    },
    {
      id: 'sortOrder',
      header: () => m.intake_checklist_field_sort_order(),
      cell: (item) => String(item.sortOrder),
      cellClassName: 'tabular-nums',
    },
    {
      id: 'isActive',
      header: () => m.intake_checklist_field_active(),
      cell: (item) =>
        renderActiveCell(
          item.isActive,
          item.isActive
            ? m.intake_checklist_admin_active_yes()
            : m.intake_checklist_admin_active_no(),
        ),
    },
  ],
  formFields: [
    // `code` is create-only (decision 12 / D3 in the plan): an order stores it inside its
    // `checklist` map, so changing it later would orphan every order that used it. The update
    // schema is `.strict()` and omits `code` entirely, so a body that carries it is REJECTED, not
    // quietly cleaned — the two-entry create/edit split (same key, `createOnly` vs `editOnly`
    // readonly) is the pattern every other catalog in this file uses for the same need.
    {
      key: 'code',
      label: () => m.intake_checklist_field_code(),
      type: 'text',
      createOnly: true,
      required: true,
      hint: () => m.intake_checklist_field_code_hint(),
    },
    {
      key: 'code',
      label: () => m.intake_checklist_field_code(),
      type: 'readonly',
      editOnly: true,
      hint: () => m.intake_checklist_field_code_hint(),
    },
    {
      key: 'nameSr',
      label: () => m.intake_checklist_field_name_sr(),
      type: 'text',
      required: true,
    },
    // Required, not optional: the work order prints in both languages, so an item saved without
    // an English name would print Serbian on the English sheet.
    {
      key: 'nameEn',
      label: () => m.intake_checklist_field_name_en(),
      type: 'text',
      required: true,
      hint: () => m.intake_checklist_field_name_en_hint(),
    },
    {
      key: 'sortOrder',
      label: () => m.intake_checklist_field_sort_order(),
      type: 'number',
    },
  ],
  createSchema:
    IntakeChecklistItemCreateInputSchema as unknown as z.ZodType<IntakeChecklistItemCreateInput>,
  updateSchema:
    IntakeChecklistItemUpdateInputSchema as unknown as z.ZodType<IntakeChecklistItemUpdateInput>,
  title: () => m.intake_checklist_admin_title(),
  subtitle: () => m.intake_checklist_admin_description(),
  addLabel: () => m.intake_checklist_admin_add(),
  emptyLabel: () => m.intake_checklist_admin_empty(),
  createTitle: () => m.intake_checklist_admin_create_title(),
  editTitle: () => m.intake_checklist_admin_edit_title(),
  createSuccessMessage: () => m.intake_checklist_admin_create_success(),
  updateSuccessMessage: () => m.intake_checklist_admin_update_success(),
  deactivateTitle: () => m.intake_checklist_admin_deactivate_title(),
  deactivateDescription: (item) =>
    m.intake_checklist_admin_deactivate_description({ name: item.nameSr }),
  deactivateConfirmLabel: () => m.intake_checklist_admin_deactivate_confirm(),
  deactivateSuccessMessage: () => m.intake_checklist_admin_deactivate_success(),
  activeYesLabel: () => m.intake_checklist_admin_active_yes(),
  activeNoLabel: () => m.intake_checklist_admin_active_no(),
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
  // Deliberately no `code` and no `id` here — see the formFields comment above. Pinned by
  // intake-checklist.definition.test.ts, which mutation-tests this exact line.
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
    // `0`, not a placeholder: `IntakeChecklistItemsService.softDelete` has no usage guard at all,
    // by design — a code lives inside every order's jsonb `checklist` map, so counting real usage
    // would mean scanning every order, and blocking removal would leave the shop unable to retire
    // an item it stopped checking (plan D3). "0 blocks nothing" is literally true here, so the
    // hard-delete button below is never disabled for this catalog.
    getUsageCount: () => 0,
    reactivateTitle: () => m.intake_checklist_admin_reactivate_title(),
    reactivateDescription: (item) =>
      m.intake_checklist_admin_reactivate_description({ name: item.nameSr }),
    reactivateConfirmLabel: () => m.intake_checklist_admin_reactivate_confirm(),
    reactivateSuccessMessage: () => m.intake_checklist_admin_reactivate_success(),
    // Deliberately NOT the other catalogs' "permanently deleted, cannot be undone" copy — that
    // would be false here. The row leaves this list, but the code stays on every order that
    // already recorded it (plan D3), and re-creating the same code later revives the same row
    // (IntakeChecklistItemsRepository.create → revive).
    hardDeleteTitle: () => m.intake_checklist_admin_hard_delete_title(),
    hardDeleteDescription: (item) =>
      m.intake_checklist_admin_hard_delete_description({ name: item.nameSr }),
    hardDeleteConfirmLabel: () => m.intake_checklist_admin_hard_delete_confirm(),
    hardDeleteSuccessMessage: () => m.intake_checklist_admin_hard_delete_success(),
    // Never actually shown (`getUsageCount` always returns 0), but the type requires it.
    hardDeleteBlockedTooltip: () => m.admin_catalog_hard_delete_blocked(),
  },
}
