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
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
  useLocale,
} from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

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
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const loaded = detail.data
  useEffect(() => {
    if (loaded === undefined) return
    setNameSr(loaded.nameSr)
    setNameEn(loaded.nameEn)
    setDescription(loaded.description ?? '')
    setSelected(new Set(loaded.permissions))
  }, [loaded])

  const held = useMemo(() => new Set(heldPermissions), [heldPermissions])
  const groups = useMemo(() => groupByModule(catalog.data ?? [], english), [catalog.data, english])

  const readOnly = role?.isSystem ?? true

  /**
   * Dead only when it is OFF and the actor does not hold it. An action already in the set may
   * always be taken away — removing is never an escalation, and the server agrees (it checks only
   * what is being ADDED). Forbidding it here would leave a set nobody can shrink once its author
   * lost the action.
   */
  const isDead = (permission: string): boolean =>
    readOnly || (!selected.has(permission) && !held.has(permission))

  const toggle = (permission: string): void => {
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
        permissions: [...selected] as Permission[],
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

  const title = readOnly ? m.roles_editor_title_view() : m.roles_editor_title_edit()

  return (
    <Dialog open={role !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {readOnly ? (
            <DialogDescription>{m.roles_system_readonly_hint()}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">{m.roles_field_name_sr()}</span>
            <Input
              value={nameSr}
              disabled={readOnly}
              onChange={(event) => setNameSr(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{m.roles_field_name_en()}</span>
            <Input
              value={nameEn}
              disabled={readOnly}
              onChange={(event) => setNameEn(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{m.roles_field_description()}</span>
            <Input
              value={description}
              disabled={readOnly}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>

        {role !== null && role.userCount > 0 && !readOnly ? (
          <p className="rounded-md border border-mr-warning bg-mr-warning-subtle px-3 py-2 text-sm text-mr-warning-strong">
            {m.roles_holders_warning({ count: role.userCount })}
          </p>
        ) : null}

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">{m.roles_matrix_title()}</h3>

          {groups.map((group) => (
            <fieldset key={group.module} className="space-y-2 rounded-md border border-border p-3">
              <legend className="flex items-center gap-2 px-1 text-sm font-medium">
                {group.label}
                {readOnly ? null : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setGroup(group, true)}
                    >
                      {m.roles_matrix_all()}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setGroup(group, false)}
                    >
                      {m.roles_matrix_none()}
                    </Button>
                  </>
                )}
              </legend>

              {group.items.map((item) => {
                const inputId = `permission-${item.id}`
                const dead = isDead(item.id)

                return (
                  <label
                    key={item.id}
                    htmlFor={inputId}
                    className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-border"
                      checked={selected.has(item.id)}
                      disabled={dead}
                      onChange={() => toggle(item.id)}
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">
                        {english ? item.nameEn : item.nameSr}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {english ? item.descriptionEn : item.descriptionSr}
                      </span>
                      {dead && !readOnly ? (
                        <span className="block text-xs text-mr-warning-strong">
                          {m.roles_dead_action_hint()}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          ))}
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {m.action_cancel()}
          </Button>
          {readOnly ? null : (
            <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
              {m.action_save()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
