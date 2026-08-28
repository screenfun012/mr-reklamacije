import { m } from '@mr/i18n'
import {
  permissionCatalogOptions,
  roleDetailOptions,
  rolesQueryKeys,
  updateRole,
  type PermissionCatalogItem,
  type Permission,
  type RoleListItem,
} from '@mr/shared'
import { cn, Dialog, DialogContent, DialogDescription, DialogTitle, toast, useLocale } from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  admFieldClassName,
  admLabelClassName,
  admPrimaryButtonClassName,
  admSecondaryButtonClassName,
} from '~/lib/adm-chrome'

import { roleModuleLabel } from './role-module-labels.js'

export interface RoleEditorDialogProps {
  role: RoleListItem | null
  heldPermissions: readonly string[]
  onClose: () => void
}

interface ModuleGroup {
  module: string
  label: string
  items: PermissionCatalogItem[]
}

function groupByModule(catalog: readonly PermissionCatalogItem[], english: boolean): ModuleGroup[] {
  const groups = new Map<string, PermissionCatalogItem[]>()

  for (const item of catalog) {
    const bucket = groups.get(item.module)
    if (bucket === undefined) groups.set(item.module, [item])
    else bucket.push(item)
  }

  return [...groups.entries()]
    .map(([module, items]) => ({
      module,
      label: roleModuleLabel(module),
      items: [...items].sort((a, b) =>
        (english ? a.nameEn : a.nameSr).localeCompare(english ? b.nameEn : b.nameSr, 'sr'),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'sr'))
}

/**
 * The set's name and its actions, as a matrix grouped by module.
 *
 * A standard set opens here too, read-only — the spec's decision, so a person can read what a
 * package actually contains before deciding to copy it. `RolesService.assertEditable` refuses the
 * PATCH anyway; this is the half that explains instead of erroring.
 */
export function RoleEditorDialog({
  role,
  heldPermissions,
  onClose,
}: RoleEditorDialogProps): React.ReactElement {
  const { locale } = useLocale()
  const english = locale === 'en'
  const queryClient = useQueryClient()

  const catalog = useQuery(permissionCatalogOptions())
  const detail = useQuery({
    ...roleDetailOptions(role?.id ?? ''),
    enabled: role !== null,
  })

  const [nameSr, setNameSr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<Permission>>(new Set())

  /**
   * Which row this form was filled from — `null` until the row arrives.
   *
   * ⚠ It exists so the form is filled **once per set**, not on every answer. React Query keeps a
   * 30 s stale time and refetches on window focus, and ticking through a matrix of 84 boxes takes
   * longer than that; an effect that re-seeds on `detail.data` throws the person's work away the
   * moment anything about the row changes underneath — another admin assigning the set moves
   * `userCount`, and every tick since the dialog opened is gone with no message. A form is a
   * snapshot of the row as it was opened; the server has the last word at save time, not before.
   *
   * It doubles as the guard on Save: an empty form is not the set, and sending it would mean
   * "no actions at all".
   */
  const [seededFrom, setSeededFrom] = useState<string | null>(null)

  const loaded = detail.data
  useEffect(() => {
    if (loaded === undefined || seededFrom === loaded.id) return
    setNameSr(loaded.nameSr)
    setNameEn(loaded.nameEn)
    setDescription(loaded.description ?? '')
    setSelected(new Set(loaded.permissions))
    setSeededFrom(loaded.id)
  }, [loaded, seededFrom])

  const held = useMemo(() => new Set(heldPermissions), [heldPermissions])
  const groups = useMemo(() => groupByModule(catalog.data ?? [], english), [catalog.data, english])

  const readOnly = role?.isSystem ?? true

  /**
   * Dead only when it is OFF and the actor does not hold it. An action already in the set may
   * always be taken away — removing is never an escalation, and the server agrees (it checks only
   * what is being ADDED). Forbidding it here would leave a set nobody can shrink once its author
   * lost the action.
   */
  const isDead = (permission: Permission): boolean =>
    readOnly || (!selected.has(permission) && !held.has(permission))

  const toggle = (permission: Permission): void => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(permission)) next.delete(permission)
      else next.add(permission)
      return next
    })
  }

  const setGroup = (group: ModuleGroup, on: boolean): void => {
    setSelected((previous) => {
      const next = new Set(previous)
      for (const item of group.items) {
        if (on) {
          if (held.has(item.id)) next.add(item.id)
        } else {
          next.delete(item.id)
        }
      }
      return next
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      if (role === null) throw new Error('no role to save')
      return updateRole(role.id, {
        nameSr,
        nameEn,
        description: description.trim() === '' ? null : description.trim(),
        permissions: [...selected],
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesQueryKeys.all })
      toast.success(m.roles_saved())
      onClose()
    },
    onError: () => {
      toast.error(m.roles_save_error())
    },
  })

  const holderCount = loaded?.userCount ?? role?.userCount ?? 0

  const title = readOnly ? m.roles_editor_title_view() : m.roles_editor_title_edit()

  return (
    <Dialog open={role !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        unstyled
        hideClose
        className="left-1/2 top-1/2 flex max-h-[92vh] w-[1100px] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-mr-border-strong bg-adm-raised shadow-[0_28px_70px_rgba(0,0,0,.5)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=open]:duration-[250ms] motion-reduce:animate-none"
      >
        <div className="flex-none border-b border-border px-6 pb-3.5 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle className="text-lg font-extrabold">{title}</DialogTitle>
            {readOnly ? (
              <span className="rounded-[7px] bg-adm-blu/[0.13] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-adm-blu">
                {m.roles_badge_standard()} · {m.roles_action_view()}
              </span>
            ) : null}
            <span className="ml-auto font-mono text-[11.5px] font-semibold uppercase text-muted-foreground">
              {m.roles_matrix_selected({ count: selected.size, total: catalog.data?.length ?? 0 })}
            </span>
          </div>

          {readOnly ? (
            <DialogDescription className="mt-3 rounded-[10px] border border-adm-blu/30 bg-adm-blu/[0.09] px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-foreground">
              {m.roles_system_readonly_hint()}
            </DialogDescription>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                  <span className={admLabelClassName}>{m.roles_field_name_sr()}</span>
                  <input
                    className={`${admFieldClassName} h-10 text-[13.5px]`}
                    value={nameSr}
                    onChange={(event) => setNameSr(event.target.value)}
                  />
                </label>
                <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                  <span className={admLabelClassName}>{m.roles_field_name_en()}</span>
                  <input
                    className={`${admFieldClassName} h-10 text-[13.5px]`}
                    value={nameEn}
                    onChange={(event) => setNameEn(event.target.value)}
                  />
                </label>
                <label className="flex min-w-[240px] flex-[1.4] flex-col gap-1.5">
                  <span className={admLabelClassName}>{m.roles_field_description()}</span>
                  <input
                    className={`${admFieldClassName} h-10 text-[13.5px]`}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
              </div>

              {/*
                The count comes from the row itself, NOT from the list entry that opened this dialog.
                The list entry is a snapshot of the moment somebody clicked "Izmeni"; if a person is
                assigned the set while it is being edited, that snapshot still says nobody holds it —
                and saving would sign three people out having promised it affects no one. The form
                deliberately does not follow the server (see `seededFrom`); this sentence
                deliberately does, because it is a statement about the world and not about what is
                being typed.
              */}
              {holderCount > 0 ? (
                <p className="mt-2.5 rounded-[10px] border border-adm-amb/35 bg-adm-amb/[0.09] px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-foreground">
                  {m.roles_holders_warning({ count: holderCount })}
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* Three columns of module cards. `columns` rather than a grid: the cards are different
            heights (three actions to nine), and a grid would leave a ragged hole under every short
            one — this is the one layout CSS columns is actually for. */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          <div className="gap-3.5 md:columns-2 xl:columns-3">
            {groups.map((group) => {
              const chosen = group.items.filter((item) => selected.has(item.id)).length

              return (
                <fieldset
                  key={group.module}
                  className="mb-3.5 break-inside-avoid rounded-xl border border-border bg-card px-3.5 py-3"
                >
                  <legend className="sr-only">{group.label}</legend>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex-1 text-[12.5px] font-extrabold text-foreground">
                      {group.label}
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                      {chosen}/{group.items.length}
                    </span>
                    {readOnly ? null : (
                      <>
                        <button
                          type="button"
                          className="cursor-pointer px-1 font-mono text-[9.5px] font-bold uppercase text-adm-red-h"
                          onClick={() => setGroup(group, true)}
                        >
                          {m.roles_matrix_all()}
                        </button>
                        <button
                          type="button"
                          className="cursor-pointer px-1 font-mono text-[9.5px] font-bold uppercase text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => setGroup(group, false)}
                        >
                          {m.roles_matrix_none()}
                        </button>
                      </>
                    )}
                  </div>

                  {group.items.map((item) => {
                    const inputId = `permission-${item.id}`
                    const dead = isDead(item.id)

                    return (
                      <label
                        key={item.id}
                        htmlFor={inputId}
                        // The description rides along as the tooltip. On the screen it would triple
                        // the height of eighty-four rows and push the last module off three columns.
                        title={english ? item.descriptionEn : item.descriptionSr}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-1 py-[5px]',
                          dead ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
                        )}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          className="peer sr-only"
                          checked={selected.has(item.id)}
                          disabled={dead}
                          onChange={() => toggle(item.id)}
                        />
                        <span
                          aria-hidden="true"
                          className="grid size-[17px] flex-none place-items-center rounded-[5px] border-[1.5px] border-mr-border-strong text-transparent peer-checked:border-adm-grn peer-checked:bg-adm-grn peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-mr-brand/40"
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        <span className="text-[12px] text-foreground">
                          {english ? item.nameEn : item.nameSr}
                        </span>
                      </label>
                    )
                  })}

                  {/* One sentence per module, not per box: the reason is the same for every dead
                      action in it, and eighty-four copies of it is noise. */}
                  {!readOnly && group.items.some((item) => isDead(item.id)) ? (
                    <p className="mt-1.5 text-[11px] leading-[1.45] text-adm-amb">
                      {m.roles_dead_action_hint()}
                    </p>
                  ) : null}
                </fieldset>
              )
            })}
          </div>
        </div>

        <div className="flex flex-none gap-2.5 border-t border-border px-6 py-3.5">
          <button
            type="button"
            className={`${admSecondaryButtonClassName} ml-auto flex-none px-6`}
            onClick={onClose}
          >
            {readOnly ? m.action_close() : m.action_cancel()}
          </button>
          {readOnly ? null : (
            <button
              type="button"
              className={`${admPrimaryButtonClassName} flex-none px-7`}
              disabled={save.isPending || seededFrom === null}
              onClick={() => save.mutate()}
            >
              {m.action_save()}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
