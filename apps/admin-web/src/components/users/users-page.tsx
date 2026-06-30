import {
  DEFAULT_APPROVE_REGISTRATION_ROLE,
  SYSTEM_ROLE_CLIENT,
  UserAccountStatus,
  formatListDateTime,
  isProtectedSuperAdminEmail,
  patchUserAccountStatus,
  patchUserRoles,
  resendClientActivation,
  resetUserPassword,
  usersListOptions,
  usersListQueryKey,
  type AccountApprovalRoleCode,
  type ApproveRegistrationRoleCode,
  type UserListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, dataTableRowHoverOnlyClassName, Heading, Skeleton, toast } from '@mr/ui'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'

import { authClient } from '~/lib/auth-client'

import { UserAccountStatusBadge } from './user-account-status-badge'
import { UserApproveDialog } from './user-approve-dialog'
import { UserPasswordResetDialog } from './user-password-reset-dialog'
import { UserRolesBadges } from './user-roles-badges'
import { UserRolesEditDialog } from './user-roles-edit-dialog'

function canEditUserRoles(user: UserListItem, currentUserId: string | undefined): boolean {
  if (user.accountStatus !== UserAccountStatus.Approved) {
    return false
  }

  if (currentUserId !== undefined && user.id === currentUserId) {
    return false
  }

  if (isProtectedSuperAdminEmail(user.email)) {
    return false
  }

  return true
}

function UsersTable({
  items,
  currentUserId,
  onApprove,
  onReject,
  onEditRoles,
  onResetPassword,
  onResendActivation,
  showActions,
  showRoleEdit,
  pending,
  actionsDisabled,
  rolesEditDisabled,
  passwordResetDisabled,
  resendActivationDisabled,
}: {
  items: readonly UserListItem[]
  currentUserId: string | undefined
  onApprove: (user: UserListItem) => void
  onReject: (user: UserListItem) => void
  onEditRoles: (user: UserListItem) => void
  onResetPassword: (user: UserListItem) => void
  onResendActivation: (user: UserListItem) => void
  showActions: boolean
  showRoleEdit: boolean
  pending: boolean
  actionsDisabled: boolean
  rolesEditDisabled: boolean
  passwordResetDisabled: boolean
  resendActivationDisabled: boolean
}): ReactElement {
  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
        role="status"
      >
        <p className="text-sm text-muted-foreground">
          {pending ? m.users_pending_empty() : m.users_all_empty()}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.users_col_name()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.users_col_email()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.users_col_status()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.users_col_roles()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.users_col_registered()}
              </th>
              {showActions || showRoleEdit ? (
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  <span className="sr-only">{m.users_col_actions()}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((user) => {
              const isSelf = currentUserId !== undefined && user.id === currentUserId
              const canAct = showActions && !isSelf
              const canEditRoles = showRoleEdit && canEditUserRoles(user, currentUserId)
              // A client's role is bound to a linked customer; the generic role
              // editor cannot express that, so it is hidden for clients (they keep
              // the password reset action). Client roles are managed via approval.
              const isClient = user.roles.includes(SYSTEM_ROLE_CLIENT)

              return (
                <tr key={user.id} className={dataTableRowHoverOnlyClassName}>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <UserAccountStatusBadge status={user.accountStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <UserRolesBadges roles={user.roles} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatListDateTime(user.createdAt)}
                  </td>
                  {showActions || showRoleEdit ? (
                    <td className="px-4 py-3">
                      {canAct ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={actionsDisabled}
                            onClick={() => onApprove(user)}
                          >
                            {m.users_approve_button()}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={actionsDisabled}
                            onClick={() => onReject(user)}
                          >
                            {m.users_reject_button()}
                          </Button>
                        </div>
                      ) : canEditRoles ? (
                        <div className="flex justify-end gap-2">
                          {isClient ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={resendActivationDisabled}
                              onClick={() => onResendActivation(user)}
                            >
                              {m.users_resend_activation_button()}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={passwordResetDisabled}
                            onClick={() => onResetPassword(user)}
                          >
                            {m.users_reset_password_button()}
                          </Button>
                          {isClient ? null : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={rolesEditDisabled}
                              onClick={() => onEditRoles(user)}
                            >
                              {m.users_roles_edit_button()}
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function UsersPageContent(): ReactElement {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const currentUserId = session?.user.id
  const { data: users } = useSuspenseQuery(usersListOptions())
  const [approveTarget, setApproveTarget] = useState<UserListItem | null>(null)
  const [rolesEditTarget, setRolesEditTarget] = useState<UserListItem | null>(null)
  const [passwordResetTarget, setPasswordResetTarget] = useState<UserListItem | null>(null)

  const pendingUsers = users.filter((user) => user.accountStatus === UserAccountStatus.Pending)
  const otherUsers = users.filter((user) => user.accountStatus !== UserAccountStatus.Pending)

  const statusMutation = useMutation({
    mutationFn: ({
      userId,
      status,
      roleCode,
      customerIds,
    }: {
      userId: string
      status: typeof UserAccountStatus.Approved | typeof UserAccountStatus.Rejected
      roleCode?: AccountApprovalRoleCode
      customerIds?: string[]
    }) =>
      status === UserAccountStatus.Approved
        ? patchUserAccountStatus(userId, {
            status,
            roleCode: roleCode ?? DEFAULT_APPROVE_REGISTRATION_ROLE,
            customerIds: customerIds ?? [],
          })
        : patchUserAccountStatus(userId, { status }),
    onMutate: async ({ userId, status, roleCode }) => {
      await queryClient.cancelQueries({ queryKey: usersListQueryKey() })
      const previous = queryClient.getQueryData<UserListItem[]>(usersListQueryKey())

      queryClient.setQueryData<UserListItem[]>(usersListQueryKey(), (old) =>
        old?.map((user) =>
          user.id === userId
            ? {
                ...user,
                accountStatus: status,
                roles:
                  status === UserAccountStatus.Approved && roleCode !== undefined
                    ? [roleCode]
                    : user.roles,
              }
            : user,
        ),
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(usersListQueryKey(), context.previous)
      }
      toast.error(m.users_status_update_error())
    },
    onSuccess: (_data, variables) => {
      if (variables.status === UserAccountStatus.Approved) {
        setApproveTarget(null)
      }
      toast.success(
        variables.status === UserAccountStatus.Approved
          ? m.users_approve_success()
          : m.users_reject_success(),
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersListQueryKey() })
    },
  })

  const rolesMutation = useMutation({
    mutationFn: ({
      userId,
      roleCodes,
    }: {
      userId: string
      roleCodes: ApproveRegistrationRoleCode[]
    }) => patchUserRoles(userId, { roleCodes }),
    onMutate: async ({ userId, roleCodes }) => {
      await queryClient.cancelQueries({ queryKey: usersListQueryKey() })
      const previous = queryClient.getQueryData<UserListItem[]>(usersListQueryKey())

      queryClient.setQueryData<UserListItem[]>(usersListQueryKey(), (old) =>
        old?.map((user) => (user.id === userId ? { ...user, roles: [...roleCodes].sort() } : user)),
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(usersListQueryKey(), context.previous)
      }
      toast.error(m.users_roles_update_error())
    },
    onSuccess: () => {
      setRolesEditTarget(null)
      toast.success(m.users_roles_update_success())
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersListQueryKey() })
    },
  })

  const passwordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      resetUserPassword(userId, { newPassword }),
    onError: () => {
      toast.error(m.users_reset_password_error())
    },
    onSuccess: () => {
      setPasswordResetTarget(null)
      toast.success(m.users_reset_password_success())
    },
  })

  const resendActivationMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) => resendClientActivation(userId),
    onError: () => {
      toast.error(m.users_resend_activation_error())
    },
    onSuccess: (result) => {
      if (result.sent) {
        toast.success(m.users_resend_activation_success())
      } else {
        toast.warning(m.users_resend_activation_not_sent())
      }
    },
  })

  const handleResendActivation = (user: UserListItem): void => {
    resendActivationMutation.mutate({ userId: user.id })
  }

  const handleApproveClick = (user: UserListItem): void => {
    setApproveTarget(user)
  }

  const handlePasswordResetConfirm = (user: UserListItem, newPassword: string): void => {
    passwordMutation.mutate({ userId: user.id, newPassword })
  }

  const handleApproveConfirm = (
    user: UserListItem,
    roleCode: AccountApprovalRoleCode,
    customerIds: string[],
  ): void => {
    statusMutation.mutate({
      userId: user.id,
      status: UserAccountStatus.Approved,
      roleCode,
      customerIds,
    })
  }

  const handleReject = (user: UserListItem): void => {
    statusMutation.mutate({ userId: user.id, status: UserAccountStatus.Rejected })
  }

  const handleRolesEditConfirm = (
    user: UserListItem,
    roleCodes: ApproveRegistrationRoleCode[],
  ): void => {
    rolesMutation.mutate({ userId: user.id, roleCodes })
  }

  return (
    <div className="space-y-8">
      <div>
        <Heading level="h1" className="mb-2">
          {m.nav_users()}
        </Heading>
        <p className="text-muted-foreground">{m.users_page_subtitle()}</p>
      </div>

      <UserApproveDialog
        user={approveTarget}
        open={approveTarget !== null}
        pending={statusMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setApproveTarget(null)
          }
        }}
        onConfirm={handleApproveConfirm}
      />

      <UserRolesEditDialog
        user={rolesEditTarget}
        open={rolesEditTarget !== null}
        pending={rolesMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setRolesEditTarget(null)
          }
        }}
        onConfirm={handleRolesEditConfirm}
      />

      <UserPasswordResetDialog
        user={passwordResetTarget}
        open={passwordResetTarget !== null}
        pending={passwordMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordResetTarget(null)
          }
        }}
        onConfirm={handlePasswordResetConfirm}
      />

      <section aria-labelledby="users-pending-heading">
        <Heading level="h2" id="users-pending-heading" className="mb-4 text-lg">
          {m.users_pending_section_title()}
        </Heading>
        <UsersTable
          items={pendingUsers}
          currentUserId={currentUserId}
          onApprove={handleApproveClick}
          onReject={handleReject}
          onEditRoles={setRolesEditTarget}
          onResetPassword={setPasswordResetTarget}
          onResendActivation={handleResendActivation}
          showActions
          showRoleEdit={false}
          pending
          actionsDisabled={statusMutation.isPending}
          rolesEditDisabled={rolesMutation.isPending}
          passwordResetDisabled={passwordMutation.isPending}
          resendActivationDisabled={resendActivationMutation.isPending}
        />
      </section>

      <section aria-labelledby="users-all-heading">
        <Heading level="h2" id="users-all-heading" className="mb-4 text-lg">
          {m.users_all_section_title()}
        </Heading>
        <UsersTable
          items={otherUsers}
          currentUserId={currentUserId}
          onApprove={handleApproveClick}
          onReject={handleReject}
          onEditRoles={setRolesEditTarget}
          onResetPassword={setPasswordResetTarget}
          onResendActivation={handleResendActivation}
          showActions={false}
          showRoleEdit
          pending={false}
          actionsDisabled={statusMutation.isPending}
          rolesEditDisabled={rolesMutation.isPending}
          passwordResetDisabled={passwordMutation.isPending}
          resendActivationDisabled={resendActivationMutation.isPending}
        />
      </section>
    </div>
  )
}

export function UsersPageSkeleton(): ReactElement {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
