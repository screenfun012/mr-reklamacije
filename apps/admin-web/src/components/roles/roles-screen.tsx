import { m } from '@mr/i18n'
import {
  deleteRole,
  duplicateRole,
  rolesListOptions,
  rolesQueryKeys,
  type RoleListItem,
} from '@mr/shared'
import {
  cn,
  dataTableCardClassName,
  dataTableCellClassName,
  dataTableHeadRowClassName,
  dataTableRowHoverOnlyClassName,
  panelHeaderClassName,
  panelMetaClassName,
  panelTitleClassName,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
  useLocale,
} from '@mr/ui'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { AdmConfirmDialog } from '~/components/adm-confirm-dialog'
import {
  admFieldClassName,
  admLabelClassName,
  admPrimaryButtonClassName,
  admSecondaryButtonClassName,
} from '~/lib/adm-chrome'
import { admTableHeadCellClassName, admTableScrollClassName } from '~/lib/adm-chrome'
import { rowActionClassName } from '~/lib/resource/resource-row-actions'

import { RoleEditorDialog } from './role-editor-dialog.js'

export interface RolesScreenProps {
  /**
   * The signed-in actor's own effective actions, read from the session by the route. It is what
   * "you cannot hand out what you do not hold" is drawn against — the server judges it again.
   */
  heldPermissions: readonly string[]
}

/**
 * The two kinds, told apart by colour rather than by reading: blue is the system's, teal is yours.
 * Squarer than a status pill (7px) — a kind is a label, not a state.
 */
const KIND_BADGE = 'rounded-[7px] px-2.5 py-1 font-mono text-[9px] font-bold tracking-[0.1em]'
const STANDARD_BADGE = `${KIND_BADGE} bg-adm-blu/[0.13] text-adm-blu`
const CUSTOM_BADGE = `${KIND_BADGE} bg-adm-teal/[0.14] text-adm-teal`

export function RolesScreen({ heldPermissions }: RolesScreenProps): React.ReactElement {
  const { locale } = useLocale()
  const english = locale === 'en'
  const queryClient = useQueryClient()

  const { data: roles } = useSuspenseQuery(rolesListOptions())

  const [editing, setEditing] = useState<RoleListItem | null>(null)
  const [duplicating, setDuplicating] = useState<RoleListItem | null>(null)
  const [deleting, setDeleting] = useState<RoleListItem | null>(null)

  const remove = useMutation({
    mutationFn: (role: RoleListItem) => deleteRole(role.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
      toast.success(m.roles_deleted())
      setDeleting(null)
    },
    onError: () => {
      toast.error(m.roles_save_error())
    },
  })

  const nameOf = (role: RoleListItem): string => (english ? role.nameEn : role.nameSr)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-foreground">
          {m.roles_title()}
        </h1>
        <p className="mt-[7px] max-w-[640px] text-[13px] leading-[1.6] text-muted-foreground">
          {m.roles_subtitle()}
        </p>
      </div>

      <div className={dataTableCardClassName}>
        {/* Not `m.roles_title()` — that is already the page <h1> two elements up. The plan said to
            reuse it and the plan was wrong, the same way the dashboard was on 2026-08-19. */}
        <div className={panelHeaderClassName}>
          <h2 className={panelTitleClassName}>{m.admin_catalog_list_title()}</h2>
          <span className={panelMetaClassName}>
            {m.admin_catalog_count_total({ total: roles.length })}
          </span>
        </div>

        {roles.length === 0 ? (
          <p className="px-6 py-10 text-center text-[13.5px] italic text-muted-foreground">
            {m.roles_empty()}
          </p>
        ) : (
          <div className={admTableScrollClassName}>
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className={dataTableHeadRowClassName}>
                  <th className={admTableHeadCellClassName}>{m.roles_col_name()}</th>
                  <th className={admTableHeadCellClassName}>{m.roles_col_kind()}</th>
                  <th className={admTableHeadCellClassName}>{m.roles_col_actions()}</th>
                  <th className={admTableHeadCellClassName}>{m.roles_col_holders()}</th>
                  <th className={admTableHeadCellClassName} />
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className={dataTableRowHoverOnlyClassName}>
                    <td className={dataTableCellClassName}>
                      <span className="block text-[13.5px] font-bold text-foreground">
                        {nameOf(role)}
                      </span>
                      {role.description === null ? null : (
                        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                          {role.description}
                        </span>
                      )}
                    </td>
                    <td className={dataTableCellClassName}>
                      <span className={role.isSystem ? STANDARD_BADGE : CUSTOM_BADGE}>
                        {role.isSystem ? m.roles_badge_standard() : m.roles_badge_custom()}
                      </span>
                    </td>
                    <td className={`${dataTableCellClassName} font-mono text-[13px] font-semibold`}>
                      {role.permissionCount}
                    </td>
                    <td
                      className={cn(
                        dataTableCellClassName,
                        'font-mono text-[13px] font-semibold',
                        // A set nobody holds is a set nobody has been given yet — the figure stays
                        // quiet until it means somebody would be affected by a change.
                        role.userCount === 0 ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {role.userCount}
                    </td>
                    <td className={dataTableCellClassName}>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className={`${rowActionClassName} bg-adm-inbg`}
                          onClick={() => setEditing(role)}
                        >
                          {role.isSystem ? m.roles_action_view() : m.roles_action_edit()}
                        </button>
                        <button
                          type="button"
                          className={`${rowActionClassName} bg-transparent`}
                          onClick={() => setDuplicating(role)}
                        >
                          {m.roles_action_duplicate()}
                        </button>
                        {role.isSystem ? null : (
                          <button
                            type="button"
                            // `aria-disabled`, not `disabled`: the button has to stay clickable to
                            // be able to SAY why it will not act. A truly disabled control swallows
                            // the click and the person is left with a grey button and no reason.
                            // The blocked reason also rides along as its tooltip, so the number is
                            // reachable without clicking at all.
                            aria-disabled={role.userCount > 0}
                            title={
                              role.userCount > 0
                                ? m.roles_delete_blocked({ count: role.userCount })
                                : m.roles_action_delete()
                            }
                            className={cn(
                              rowActionClassName,
                              'border-mr-brand/40 bg-transparent text-adm-red-h hover:text-adm-red-h',
                              role.userCount > 0 && 'opacity-45',
                            )}
                            onClick={() => {
                              if (role.userCount > 0) {
                                toast.error(m.roles_delete_blocked({ count: role.userCount }))
                                return
                              }
                              setDeleting(role)
                            }}
                          >
                            {m.roles_action_delete()}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing === null ? null : (
        <RoleEditorDialog
          role={editing}
          heldPermissions={heldPermissions}
          onClose={() => setEditing(null)}
        />
      )}

      {duplicating === null ? null : (
        <DuplicateRoleDialog role={duplicating} onClose={() => setDuplicating(null)} />
      )}

      <AdmConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        tag={m.admin_confirm_tag_hard_delete()}
        title={m.roles_delete_dialog_title()}
        description={
          deleting === null ? null : m.roles_delete_dialog_description({ name: nameOf(deleting) })
        }
        confirmLabel={m.roles_action_delete()}
        pending={remove.isPending}
        onConfirm={() => deleting !== null && remove.mutate(deleting)}
      />
    </div>
  )
}

/**
 * A copy needs only a new name — the actions come from the original, which is why the panel has no
 * "start from nothing": with 21 standard packages on the list, copying one is always the shorter
 * road to a set that makes sense. (The prototype draws a "+ Novo ovlašćenje" button; Nikola kept
 * this decision on 19.08.2026 — an empty grid of 84 boxes is a worse starting point than a copy.)
 */
function DuplicateRoleDialog({
  role,
  onClose,
}: {
  role: RoleListItem
  onClose: () => void
}): React.ReactElement {
  const queryClient = useQueryClient()
  const [nameSr, setNameSr] = useState(`${role.nameSr} (kopija)`)
  const [nameEn, setNameEn] = useState(`${role.nameEn} (copy)`)

  const copy = useMutation({
    mutationFn: () => duplicateRole(role.id, { nameSr, nameEn }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
      toast.success(m.roles_saved())
      onClose()
    },
    onError: () => {
      toast.error(m.roles_save_error())
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{m.roles_duplicate_dialog_title()}</DialogTitle>
          <DialogDescription>{m.roles_duplicate_dialog_description()}</DialogDescription>
        </DialogHeader>

        <label className="block space-y-1.5">
          <span className={admLabelClassName}>{m.roles_field_name_sr()}</span>
          <input
            className={admFieldClassName}
            value={nameSr}
            onChange={(event) => setNameSr(event.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={admLabelClassName}>{m.roles_field_name_en()}</span>
          <input
            className={admFieldClassName}
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
          />
        </label>

        <DialogFooter className="gap-2.5 sm:justify-stretch">
          <button type="button" className={admSecondaryButtonClassName} onClick={onClose}>
            {m.action_cancel()}
          </button>
          <button
            type="button"
            className={admPrimaryButtonClassName}
            disabled={copy.isPending}
            onClick={() => copy.mutate()}
          >
            {m.action_save()}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
