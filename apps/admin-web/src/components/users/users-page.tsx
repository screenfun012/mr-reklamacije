import {
  UserAccountStatus,
  formatListDateTime,
  patchUserAccountStatus,
  usersListOptions,
  usersListQueryKey,
  type UserListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import { Button, dataTableRowHoverOnlyClassName, Heading, Skeleton, toast } from '@mr/ui'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { authClient } from '~/lib/auth-client'

import { UserAccountStatusBadge } from './user-account-status-badge'

function UsersTable({
  items,
  currentUserId,
  onApprove,
  onReject,
  showActions,
  pending,
  actionsDisabled,
}: {
  items: readonly UserListItem[]
  currentUserId: string | undefined
  onApprove: (user: UserListItem) => void
  onReject: (user: UserListItem) => void
  showActions: boolean
  pending: boolean
  actionsDisabled: boolean
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
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.users_col_name()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">{m.users_col_email()}</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.users_col_status()}
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                {m.users_col_registered()}
              </th>
              {showActions ? (
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

              return (
                <tr key={user.id} className={dataTableRowHoverOnlyClassName}>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <UserAccountStatusBadge status={user.accountStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatListDateTime(user.createdAt)}
                  </td>
                  {showActions ? (
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

  const pendingUsers = users.filter((user) => user.accountStatus === UserAccountStatus.Pending)
  const otherUsers = users.filter((user) => user.accountStatus !== UserAccountStatus.Pending)

  const statusMutation = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string
      status: typeof UserAccountStatus.Approved | typeof UserAccountStatus.Rejected
    }) => patchUserAccountStatus(userId, { status }),
    onMutate: async ({ userId, status }) => {
      await queryClient.cancelQueries({ queryKey: usersListQueryKey() })
      const previous = queryClient.getQueryData<UserListItem[]>(usersListQueryKey())

      queryClient.setQueryData<UserListItem[]>(usersListQueryKey(), (old) =>
        old?.map((user) => (user.id === userId ? { ...user, accountStatus: status } : user)),
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

  const handleApprove = (user: UserListItem): void => {
    statusMutation.mutate({ userId: user.id, status: UserAccountStatus.Approved })
  }

  const handleReject = (user: UserListItem): void => {
    statusMutation.mutate({ userId: user.id, status: UserAccountStatus.Rejected })
  }

  return (
    <div className="space-y-8">
      <div>
        <Heading level="h1" className="mb-2">
          {m.nav_users()}
        </Heading>
        <p className="text-muted-foreground">{m.users_page_subtitle()}</p>
      </div>

      <section aria-labelledby="users-pending-heading">
        <Heading level="h2" id="users-pending-heading" className="mb-4 text-lg">
          {m.users_pending_section_title()}
        </Heading>
        <UsersTable
          items={pendingUsers}
          currentUserId={currentUserId}
          onApprove={handleApprove}
          onReject={handleReject}
          showActions
          pending
          actionsDisabled={statusMutation.isPending}
        />
      </section>

      <section aria-labelledby="users-all-heading">
        <Heading level="h2" id="users-all-heading" className="mb-4 text-lg">
          {m.users_all_section_title()}
        </Heading>
        <UsersTable
          items={otherUsers}
          currentUserId={currentUserId}
          onApprove={handleApprove}
          onReject={handleReject}
          showActions={false}
          pending={false}
          actionsDisabled={statusMutation.isPending}
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
