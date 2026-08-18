import { m } from '@mr/i18n'
import {
  deleteRole,
  duplicateRole,
  rolesListOptions,
  rolesQueryKeys,
  type RoleListItem,
} from '@mr/shared'
import {
  BADGE_SHELL_CLASSES,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Heading,
  Input,
  toast,
  useLocale,
} from '@mr/ui'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { RoleEditorDialog } from './role-editor-dialog.js'

export interface RolesScreenProps {
  /**
   * The signed-in actor's own effective actions, read from the session by the route. It is what
   * "you cannot hand out what you do not hold" is drawn against — the server judges it again.
   */
  heldPermissions: readonly string[]
}

const STANDARD_BADGE = `${BADGE_SHELL_CLASSES} border-mr-info bg-mr-info-subtle text-mr-info-strong`
const CUSTOM_BADGE = `${BADGE_SHELL_CLASSES} border-mr-accent bg-mr-accent-subtle text-mr-accent-strong`

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
    <div className="space-y-6">
      <div className="space-y-1">
        <Heading level="h1">{m.roles_title()}</Heading>
        <p className="max-w-3xl text-sm text-muted-foreground">{m.roles_subtitle()}</p>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.roles_empty()}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{m.roles_col_name()}</th>
              <th className="py-2 pr-4 font-medium">{m.roles_col_kind()}</th>
              <th className="py-2 pr-4 font-medium">{m.roles_col_actions()}</th>
              <th className="py-2 pr-4 font-medium">{m.roles_col_holders()}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{nameOf(role)}</td>
                <td className="py-2 pr-4">
                  <span className={role.isSystem ? STANDARD_BADGE : CUSTOM_BADGE}>
                    {role.isSystem ? m.roles_badge_standard() : m.roles_badge_custom()}
                  </span>
                </td>
                <td className="py-2 pr-4 tabular-nums">{role.permissionCount}</td>
                <td className="py-2 pr-4 tabular-nums">{role.userCount}</td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {role.isSystem ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(role)}
                      >
                        {m.roles_action_edit()}
                      </Button>
                    )}
                    {role.isSystem ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(role)}
                      >
                        {m.roles_action_view()}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDuplicating(role)}
                    >
                      {m.roles_action_duplicate()}
                    </Button>
                    {role.isSystem ? null : (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={role.userCount > 0}
                          onClick={() => setDeleting(role)}
                        >
                          {m.roles_action_delete()}
                        </Button>
                        {/* A dead button has to say why — the count is the reason. */}
                        {role.userCount > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {m.roles_delete_blocked({ count: role.userCount })}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
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
 * road to a set that makes sense.
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{m.roles_duplicate_dialog_title()}</DialogTitle>
          <DialogDescription>{m.roles_duplicate_dialog_description()}</DialogDescription>
        </DialogHeader>

        <label className="block space-y-1">
          <span className="text-sm font-medium">{m.roles_field_name_sr()}</span>
          <Input value={nameSr} onChange={(event) => setNameSr(event.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{m.roles_field_name_en()}</span>
          <Input value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {m.action_cancel()}
          </Button>
          <Button type="button" disabled={copy.isPending} onClick={() => copy.mutate()}>
            {m.action_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
