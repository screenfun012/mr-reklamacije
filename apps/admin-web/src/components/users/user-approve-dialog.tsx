import {
  EMOTIVE_PARTNER_CUSTOMERS_REFERENCE,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_SERVISER,
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactElement } from 'react'

import { customersResourceDefinition } from '~/resources/customers.definition'
import { createResourceCrudHooks, resourceSaveErrorMessage } from '~/lib/resource/use-resource-crud'

// The SAME create path the Firme tab uses — one endpoint, one audit entry, one
// `ResourceChanged(Customers)` signal. A second write path here would be exactly
// the kind of parallel road that drifts (docs/16 §5.2).
const { useCreateResource: useCreateCustomer } = createResourceCrudHooks(
  customersResourceDefinition,
)

const APPROVE_ROLE_OPTIONS = [
  {
    value: SYSTEM_ROLE_OPERATOR,
    label: () => m.users_role_operator(),
    description: () => m.users_role_operator_description(),
  },
  {
    value: SYSTEM_ROLE_VIEWER,
    label: () => m.users_role_viewer(),
    description: () => m.users_role_viewer_description(),
  },
  {
    value: SYSTEM_ROLE_SERVISER,
    label: () => m.users_role_serviser(),
    description: () => m.users_role_serviser_description(),
  },
  {
    value: SYSTEM_ROLE_CLIENT,
    label: () => m.users_role_client(),
    description: () => m.users_role_client_description(),
  },
] as const satisfies ReadonlyArray<{
  value: AccountApprovalRoleCode
  label: () => string
  description: () => string
}>

/**
 * Safe default role when the approve dialog opens: a registrant who named a
 * company is a client (forces the customer link); everyone else defaults to
 * least-privilege viewer — never the most-privileged operator.
 */
function initialApproveRole(user: UserListItem | null): AccountApprovalRoleCode {
  if (user !== null && user.requestedCompany !== null && user.requestedCompany !== '') {
    return SYSTEM_ROLE_CLIENT
  }
  return SYSTEM_ROLE_VIEWER
}

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
  const [roleCode, setRoleCode] = useState<AccountApprovalRoleCode>(() => initialApproveRole(user))
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const createCustomer = useCreateCustomer()
  // This dialog instance is reused for every approval (the parent renders it
  // unconditionally), so a create that resolves late must be able to tell
  // whether it still belongs to the user on screen.
  const targetUserIdRef = useRef<string | null>(user?.id ?? null)
  targetUserIdRef.current = user?.id ?? null

  // Sync the safe default whenever the dialog opens for a given user
  // (mirror of the roles-edit dialog's [user, open] sync).
  useEffect(() => {
    if (user !== null && open) {
      setRoleCode(initialApproveRole(user))
      setCustomerId(null)
      setCreatingCustomer(false)
      // The company the applicant typed is the obvious starting name — it is
      // exactly what the approver would retype otherwise.
      setNewCustomerName(user.requestedCompany ?? '')
      setCreateError(null)
    }
  }, [user, open])

  const isClient = roleCode === SYSTEM_ROLE_CLIENT

  const customersQuery = useQuery({
    ...customersReferenceOptions(EMOTIVE_PARTNER_CUSTOMERS_REFERENCE),
    enabled: open && isClient,
  })

  const resetState = (): void => {
    setRoleCode(initialApproveRole(user))
    setCustomerId(null)
    setCreatingCustomer(false)
    setNewCustomerName(user?.requestedCompany ?? '')
    setCreateError(null)
  }

  const handleCreateCustomer = (): void => {
    const name = newCustomerName.trim()
    if (name === '' || createCustomer.isPending) {
      return
    }
    // Whose approval this create belongs to. If the dialog has moved on by the
    // time the server answers, the result must NOT be written into the new
    // target — that would silently link one client to another's firm.
    const startedForUserId = user?.id ?? null
    setCreateError(null)
    createCustomer.mutate(
      { name },
      {
        onSuccess: (created) => {
          if (startedForUserId === null || startedForUserId !== targetUserIdRef.current) {
            return
          }
          // Select it immediately: the approver opened this to link THIS firm.
          setCustomerId(created.id)
          setCreatingCustomer(false)
        },
        onError: (error) => {
          if (startedForUserId === null || startedForUserId !== targetUserIdRef.current) {
            return
          }
          // Surfaces the API's own message, e.g. the duplicate-name conflict.
          setCreateError(
            resourceSaveErrorMessage(error, m.users_approve_dialog_new_customer_error()),
          )
        },
      },
    )
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    // A create in flight owns this dialog: closing here would let its callback
    // land on whoever is approved next. Esc and outside-click come through here
    // too, so this is the single place that can hold the door.
    if (!nextOpen && createCustomer.isPending) {
      return
    }
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
            <p className="text-sm text-muted-foreground">
              {APPROVE_ROLE_OPTIONS.find((option) => option.value === roleCode)?.description()}
            </p>
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
              {!customersQuery.isPending && customers.length === 0 && !creatingCustomer ? (
                <p className="text-sm text-muted-foreground">
                  {m.users_approve_dialog_customer_empty()}
                </p>
              ) : null}

              {creatingCustomer ? (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <p id="approve-new-customer-label" className="text-sm font-medium">
                    {m.users_approve_dialog_new_customer_name()}
                  </p>
                  <Input
                    id="approve-new-customer"
                    aria-labelledby="approve-new-customer-label"
                    value={newCustomerName}
                    maxLength={200}
                    disabled={createCustomer.isPending}
                    onChange={(event) => {
                      setNewCustomerName(event.target.value)
                      // Otherwise the 409 keeps naming the firm the admin just
                      // renamed away from, and it hides the hint while typing.
                      setCreateError(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleCreateCustomer()
                      }
                    }}
                  />
                  {createError !== null ? (
                    <p className="text-sm text-mr-error" role="alert">
                      {createError}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {m.users_approve_dialog_new_customer_hint()}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={newCustomerName.trim() === '' || createCustomer.isPending}
                      onClick={handleCreateCustomer}
                    >
                      {m.users_approve_dialog_new_customer_save()}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={createCustomer.isPending}
                      onClick={() => {
                        setCreatingCustomer(false)
                        setCreateError(null)
                      }}
                    >
                      {m.users_approve_dialog_new_customer_cancel()}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCreatingCustomer(true)
                    setCreateError(null)
                  }}
                >
                  {m.users_approve_dialog_new_customer()}
                </Button>
              )}
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
