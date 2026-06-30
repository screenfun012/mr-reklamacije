import {
  DEFAULT_APPROVE_REGISTRATION_ROLE,
  EMOTIVE_PARTNER_CUSTOMERS_REFERENCE,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  customersReferenceOptions,
  type AccountApprovalRoleCode,
  type UserListItem,
} from '@mr/shared'
import { m } from '@mr/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'

const APPROVE_ROLE_OPTIONS = [
  { value: SYSTEM_ROLE_OPERATOR, label: () => m.users_role_operator() },
  { value: SYSTEM_ROLE_VIEWER, label: () => m.users_role_viewer() },
  { value: SYSTEM_ROLE_CLIENT, label: () => m.users_role_client() },
] as const satisfies ReadonlyArray<{
  value: AccountApprovalRoleCode
  label: () => string
}>

interface UserApproveDialogProps {
  user: UserListItem | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (user: UserListItem, roleCode: AccountApprovalRoleCode, customerIds: string[]) => void
}

export function UserApproveDialog({
  user,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: UserApproveDialogProps): ReactElement {
  const [roleCode, setRoleCode] = useState<AccountApprovalRoleCode>(
    DEFAULT_APPROVE_REGISTRATION_ROLE,
  )
  const [customerId, setCustomerId] = useState<string | null>(null)

  const isClient = roleCode === SYSTEM_ROLE_CLIENT

  const customersQuery = useQuery({
    ...customersReferenceOptions(EMOTIVE_PARTNER_CUSTOMERS_REFERENCE),
    enabled: open && isClient,
  })

  const resetState = (): void => {
    setRoleCode(DEFAULT_APPROVE_REGISTRATION_ROLE)
    setCustomerId(null)
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  const handleRoleChange = (value: string): void => {
    setRoleCode(value as AccountApprovalRoleCode)
    setCustomerId(null)
  }

  const handleConfirm = (): void => {
    if (user === null) {
      return
    }

    if (isClient) {
      if (customerId === null) {
        return
      }
      onConfirm(user, roleCode, [customerId])
      return
    }

    onConfirm(user, roleCode, [])
  }

  const customers = customersQuery.data ?? []
  const confirmDisabled = pending || user === null || (isClient && customerId === null)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{m.users_approve_dialog_title()}</DialogTitle>
          {user !== null ? (
            <DialogDescription>
              {m.users_approve_dialog_description({ name: user.name, email: user.email })}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          {user !== null && user.requestedCompany !== null && user.requestedCompany !== '' ? (
            <div className="rounded-md border border-mr-info-subtle bg-mr-info-subtle/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {m.users_approve_dialog_requested_company_label()}:{' '}
              </span>
              <span className="font-medium">{user.requestedCompany}</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <p id="approve-role-label" className="text-sm font-medium">
              {m.users_approve_dialog_role_label()}
            </p>
            <Select value={roleCode} onValueChange={handleRoleChange}>
              <SelectTrigger id="approve-role" aria-labelledby="approve-role-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVE_ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isClient ? (
            <div className="space-y-2">
              <p id="approve-customer-label" className="text-sm font-medium">
                {m.users_approve_dialog_customer_label()}
              </p>
              <Select
                value={customerId ?? ''}
                onValueChange={(value) => setCustomerId(value)}
                disabled={customersQuery.isPending || customers.length === 0}
              >
                <SelectTrigger id="approve-customer" aria-labelledby="approve-customer-label">
                  <SelectValue placeholder={m.users_approve_dialog_customer_placeholder()} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!customersQuery.isPending && customers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {m.users_approve_dialog_customer_empty()}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            {m.action_cancel()}
          </Button>
          <Button type="button" disabled={confirmDisabled} onClick={handleConfirm}>
            {m.users_approve_dialog_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
