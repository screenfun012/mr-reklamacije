import {
  SYSTEM_ROLE_CLIENT,
  UserAccountStatus,
  buildAccountStatusPatchBody,
  formatListDateTime,
  isProtectedSuperAdminEmail,
  patchUserAccountStatus,
  patchUserCustomerLinks,
  patchUserRoles,
  resendClientActivation,
  resetUserPassword,
  setUserActive,
  usersListOptions,
  usersListQueryKey,
  type UserListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  cn,
  dataTableCardClassName,
  dataTableCellClassName,
  dataTableEmptyClassName,
  dataTableHeadRowClassName,
  dataTableRowHoverOnlyClassName,
  panelHeaderClassName,
  panelTitleClassName,
  Skeleton,
  toast,
} from '@mr/ui'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState, type ReactElement } from 'react'

import { AdmConfirmDialog } from '~/components/adm-confirm-dialog'
import { admTableHeadCellClassName, admTableScrollClassName } from '~/lib/adm-chrome'
import { rowActionClassName } from '~/lib/resource/resource-row-actions'
import { authClient } from '~/lib/auth-client'

import { PendingUsersCard } from './pending-users-card'
import { UserAccountStatusBadge } from './user-account-status-badge'
import { UserApproveDialog } from './user-approve-dialog'
import { UserPasswordResetDialog } from './user-password-reset-dialog'
import { UserRolesBadges } from './user-roles-badges'
import { UserCustomersEditDialog } from './user-customers-edit-dialog'
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
  onEditRoles,
  onEditCustomers,
  onResetPassword,
  onResendActivation,
  onDeactivate,
  onReactivate,
  rolesEditDisabled,
  customersEditDisabled,
  passwordResetDisabled,
  resendActivationDisabled,
  setActiveDisabled,
  title,
  titleId,
  headerRight,
}: {
  items: readonly UserListItem[]
  currentUserId: string | undefined
  onEditRoles: (user: UserListItem) => void
  onEditCustomers: (user: UserListItem) => void
  onResetPassword: (user: UserListItem) => void
  onResendActivation: (user: UserListItem) => void
  onDeactivate: (user: UserListItem) => void
  onReactivate: (user: UserListItem) => void
  rolesEditDisabled: boolean
  customersEditDisabled: boolean
  passwordResetDisabled: boolean
  resendActivationDisabled: boolean
  setActiveDisabled: boolean
  /** The card's own name. */
  title: string
  /** Kept so the surrounding <section aria-labelledby> still resolves. */
  titleId: string
  /** Right of the title: the search box. */
  headerRight?: React.ReactNode
}): ReactElement {
  return (
    <div className={dataTableCardClassName}>
      <div className={panelHeaderClassName}>
        <h2 id={titleId} className={panelTitleClassName}>
          {title}
        </h2>
        {headerRight}
      </div>

      {items.length === 0 ? (
        <div className={dataTableEmptyClassName} role="status">
          {m.users_all_empty()}
        </div>
      ) : (
        <div className={admTableScrollClassName}>
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className={dataTableHeadRowClassName}>
                <th className={admTableHeadCellClassName}>{m.users_col_name()}</th>
                <th className={admTableHeadCellClassName}>{m.users_col_email()}</th>
                <th className={admTableHeadCellClassName}>{m.users_col_status()}</th>
                <th className={admTableHeadCellClassName}>{m.users_col_roles()}</th>
                <th className={admTableHeadCellClassName}>{m.users_col_registered()}</th>
                <th className={admTableHeadCellClassName}>
                  <span className="sr-only">{m.users_col_actions()}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => {
                const isSelf = currentUserId !== undefined && user.id === currentUserId
                const isProtected = isProtectedSuperAdminEmail(user.email)
                const canEditRoles = canEditUserRoles(user, currentUserId)
                // A client's role is bound to a linked customer; the generic role editor cannot
                // express that, so it is hidden for clients (they keep the password reset action).
                // Client roles are managed via approval.
                const isClient = user.roles.includes(SYSTEM_ROLE_CLIENT)

                return (
                  <tr
                    key={user.id}
                    className={cn(dataTableRowHoverOnlyClassName, !user.isActive && 'opacity-60')}
                  >
                    <td className={`${dataTableCellClassName} text-[13.5px] font-bold`}>
                      {user.name}
                      {isSelf || isProtected ? (
                        <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">
                          · {isProtected ? m.users_tag_protected() : m.users_tag_you()}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`${dataTableCellClassName} font-mono text-[11.5px] font-medium text-muted-foreground`}
                    >
                      {user.email}
                    </td>
                    <td className={dataTableCellClassName}>
                      <div className="flex flex-wrap items-center gap-2">
                        <UserAccountStatusBadge status={user.accountStatus} />
                        {user.isActive ? null : (
                          <span className="rounded-full bg-adm-gry/20 px-2.5 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] text-adm-gry">
                            {m.users_status_inactive()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={dataTableCellClassName}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <UserRolesBadges roles={user.roles} />
                        {user.customers.map((customer) => (
                          <span
                            key={customer.id}
                            title={m.users_col_customers()}
                            className="rounded-full bg-adm-teal/15 px-2.5 py-[3px] text-[11px] font-semibold text-adm-teal"
                          >
                            {customer.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td
                      className={`${dataTableCellClassName} font-mono text-[11px] font-medium text-muted-foreground`}
                    >
                      {formatListDateTime(user.createdAt)}
                    </td>
                    <td className={dataTableCellClassName}>
                      {canEditRoles ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {isClient ? (
                            <button
                              type="button"
                              className={`${rowActionClassName} bg-transparent`}
                              disabled={resendActivationDisabled}
                              onClick={() => onResendActivation(user)}
                            >
                              {m.users_resend_activation_button()}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`${rowActionClassName} bg-adm-inbg`}
                            disabled={passwordResetDisabled}
                            onClick={() => onResetPassword(user)}
                          >
                            {m.users_reset_password_button()}
                          </button>
                          {isClient ? (
                            // A client's rights are fixed; what CAN change is which firm the
                            // account speaks for — and until this button existed that took SQL.
                            <button
                              type="button"
                              className={`${rowActionClassName} bg-adm-inbg`}
                              disabled={customersEditDisabled}
                              onClick={() => onEditCustomers(user)}
                            >
                              {m.users_customers_edit_button()}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`${rowActionClassName} bg-adm-inbg`}
                              disabled={rolesEditDisabled}
                              onClick={() => onEditRoles(user)}
                            >
                              {m.users_roles_edit_button()}
                            </button>
                          )}
                          {user.isActive ? (
                            <button
                              type="button"
                              className={`${rowActionClassName} border-mr-brand/40 bg-transparent text-adm-red-h hover:text-adm-red-h`}
                              disabled={setActiveDisabled}
                              onClick={() => onDeactivate(user)}
                            >
                              {m.users_deactivate_button()}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`${rowActionClassName} bg-transparent`}
                              disabled={setActiveDisabled}
                              onClick={() => onReactivate(user)}
                            >
                              {m.users_reactivate_button()}
                            </button>
                          )}
                        </div>
                      ) : isSelf || isProtected ? (
                        // The two rows that deliberately have no actions say why. A rejected or
                        // still-pending account has none either, but there the STATUS column
                        // already explains it — a second sentence would be noise.
                        <p className="text-right text-[11px] italic text-muted-foreground">
                          {isSelf ? m.users_no_actions_self() : m.users_no_actions_protected()}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
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
  const [customersEditTarget, setCustomersEditTarget] = useState<UserListItem | null>(null)
  const [passwordResetTarget, setPasswordResetTarget] = useState<UserListItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<UserListItem | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<UserListItem | null>(null)
  const [allSearch, setAllSearch] = useState('')

  const pendingUsers = users.filter((user) => user.accountStatus === UserAccountStatus.Pending)
  const otherUsers = users.filter((user) => user.accountStatus !== UserAccountStatus.Pending)

  // The "all users" table grows unbounded (public registration, no user delete),
  // so it gets a client-side name/email filter over the already-loaded list.
  const allQuery = allSearch.trim().toLowerCase()
  const filteredOtherUsers =
    allQuery === ''
      ? otherUsers
      : otherUsers.filter(
          (user) =>
            user.name.toLowerCase().includes(allQuery) ||
            user.email.toLowerCase().includes(allQuery),
        )

  const statusMutation = useMutation({
    mutationFn: ({
      userId,
      status,
      roleCodes,
      customerIds,
    }: {
      userId: string
      status: typeof UserAccountStatus.Approved | typeof UserAccountStatus.Rejected
      roleCodes?: string[]
      customerIds?: string[]
    }) =>
      patchUserAccountStatus(
        userId,
        buildAccountStatusPatchBody({ status, roleCodes, customerIds }),
      ),
    onMutate: async ({ userId, status, roleCodes }) => {
      await queryClient.cancelQueries({ queryKey: usersListQueryKey() })
      const previous = queryClient.getQueryData<UserListItem[]>(usersListQueryKey())

      queryClient.setQueryData<UserListItem[]>(usersListQueryKey(), (old) =>
        old?.map((user) =>
          user.id === userId
            ? {
                ...user,
                accountStatus: status,
                roles:
                  status === UserAccountStatus.Approved && roleCodes !== undefined
                    ? roleCodes
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
      } else {
        setRejectTarget(null)
      }
      toast.success(
        variables.status === UserAccountStatus.Approved
          ? m.users_approve_success()
          : m.users_reject_success(),
      )
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: usersListQueryKey() })
      // Approving a user as a client links ≥1 customer (raising its usageCount),
      // so refresh the customers catalog list too.
      if (variables.customerIds && variables.customerIds.length > 0) {
        void queryClient.invalidateQueries({ queryKey: ['customers'] })
      }
    },
  })

  const rolesMutation = useMutation({
    mutationFn: ({ userId, roleCodes }: { userId: string; roleCodes: string[] }) =>
      patchUserRoles(userId, { roleCodes }),
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

  const customersMutation = useMutation({
    mutationFn: ({ userId, customerIds }: { userId: string; customerIds: string[] }) =>
      patchUserCustomerLinks(userId, { customerIds }),
    onError: () => {
      toast.error(m.users_customers_edit_error())
    },
    onSuccess: () => {
      setCustomersEditTarget(null)
      toast.success(m.users_customers_edit_success())
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersListQueryKey() })
      // The link raises a customer's usageCount, which the catalogue screen prints.
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
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

  const setActiveMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setUserActive(userId, { isActive }),
    onError: (_error, variables) => {
      toast.error(variables.isActive ? m.users_reactivate_error() : m.users_deactivate_error())
    },
    onSuccess: (_data, variables) => {
      setDeactivateTarget(null)
      toast.success(
        variables.isActive ? m.users_reactivate_success() : m.users_deactivate_success(),
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersListQueryKey() })
    },
  })

  const handleResendActivation = (user: UserListItem): void => {
    resendActivationMutation.mutate({ userId: user.id })
  }

  const handleDeactivateClick = (user: UserListItem): void => {
    setDeactivateTarget(user)
  }

  const handleDeactivateConfirm = (): void => {
    if (deactivateTarget === null) {
      return
    }
    setActiveMutation.mutate({ userId: deactivateTarget.id, isActive: false })
  }

  const handleReactivate = (user: UserListItem): void => {
    setActiveMutation.mutate({ userId: user.id, isActive: true })
  }

  const handleApproveClick = (user: UserListItem): void => {
    setApproveTarget(user)
  }

  const handlePasswordResetConfirm = (user: UserListItem, newPassword: string): void => {
    passwordMutation.mutate({ userId: user.id, newPassword })
  }

  const handleApproveConfirm = (
    user: UserListItem,
    roleCodes: string[],
    customerIds: string[],
  ): void => {
    statusMutation.mutate({
      userId: user.id,
      status: UserAccountStatus.Approved,
      roleCodes,
      customerIds,
    })
  }

  const handleRejectClick = (user: UserListItem): void => {
    setRejectTarget(user)
  }

  const handleRejectConfirm = (): void => {
    if (rejectTarget === null) {
      return
    }
    statusMutation.mutate({ userId: rejectTarget.id, status: UserAccountStatus.Rejected })
  }

  const handleRolesEditConfirm = (user: UserListItem, roleCodes: string[]): void => {
    rolesMutation.mutate({ userId: user.id, roleCodes })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-foreground">
          {m.nav_users()}
        </h1>
        <p className="mt-[5px] text-[13px] text-muted-foreground">{m.users_page_subtitle()}</p>
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

      <UserCustomersEditDialog
        user={customersEditTarget}
        open={customersEditTarget !== null}
        pending={customersMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setCustomersEditTarget(null)
          }
        }}
        onConfirm={(user, customerIds) =>
          customersMutation.mutate({ userId: user.id, customerIds })
        }
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

      <AdmConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
          }
        }}
        tag={m.users_reject_button()}
        title={m.users_reject_confirm_title()}
        description={
          rejectTarget !== null
            ? m.users_reject_confirm_description({
                name: rejectTarget.name,
                email: rejectTarget.email,
              })
            : null
        }
        confirmLabel={m.users_reject_button()}
        pending={statusMutation.isPending}
        onConfirm={handleRejectConfirm}
      />

      <AdmConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null)
          }
        }}
        tag={m.admin_confirm_tag_deactivate()}
        tone="warning"
        title={m.users_deactivate_confirm_title()}
        description={
          deactivateTarget !== null
            ? m.users_deactivate_confirm_description({ name: deactivateTarget.name })
            : null
        }
        confirmLabel={m.users_deactivate_button()}
        pending={setActiveMutation.isPending}
        onConfirm={handleDeactivateConfirm}
      />

      <PendingUsersCard
        users={pendingUsers}
        disabled={statusMutation.isPending}
        onApprove={handleApproveClick}
        onReject={handleRejectClick}
      />

      <section aria-labelledby="users-all-heading">
        <UsersTable
          title={m.users_all_section_title()}
          titleId="users-all-heading"
          headerRight={
            <label className="flex h-9 w-full max-w-[320px] items-center gap-2.5 rounded-[9px] border border-mr-border-strong bg-adm-inbg px-3 sm:w-72">
              <Search className="size-3.5 flex-none text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={allSearch}
                onChange={(event) => setAllSearch(event.target.value)}
                placeholder={m.users_search_placeholder()}
                aria-label={m.users_search_placeholder()}
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </label>
          }
          items={filteredOtherUsers}
          currentUserId={currentUserId}
          onEditRoles={setRolesEditTarget}
          onEditCustomers={setCustomersEditTarget}
          onResetPassword={setPasswordResetTarget}
          onResendActivation={handleResendActivation}
          onDeactivate={handleDeactivateClick}
          onReactivate={handleReactivate}
          rolesEditDisabled={rolesMutation.isPending}
          customersEditDisabled={customersMutation.isPending}
          passwordResetDisabled={passwordMutation.isPending}
          resendActivationDisabled={resendActivationMutation.isPending}
          setActiveDisabled={setActiveMutation.isPending}
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
