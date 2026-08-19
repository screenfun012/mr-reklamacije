import {
  AuditAction,
  ResourceChangedKey,
  SYSTEM_ROLE_CLIENT,
  UserAccountStatus,
  isProtectedSuperAdminEmail,
  type Permission,
} from '@mr/shared'

import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { ClientActivationPort } from '../../core/ports/client-activation-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { UserPasswordPort } from '../../core/ports/user-password-port.js'
import type { UserSessionsPort } from '../../core/ports/user-sessions-port.js'
import type { UsersRepository } from './users.repository.js'
import type {
  UserAccountStatusPatchInput,
  UserAccountStatusResult,
  UserListItem,
  UserListResponse,
  UserPasswordResetInput,
  UserRolesReplaceInput,
  UserSetActiveInput,
  UsersListQuery,
} from './users.validators.js'

function permissionForStatus(status: UserAccountStatusPatchInput['status']): Permission {
  return status === UserAccountStatus.Approved
    ? 'users.approve_registration'
    : 'users.reject_registration'
}

function sortedRoles(roleCodes: readonly string[]): string[] {
  return [...roleCodes].sort()
}

export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
    private readonly protectedSuperAdminEmail: string,
    private readonly userSessions: UserSessionsPort,
    private readonly userPassword: UserPasswordPort,
    private readonly activation: ClientActivationPort,
  ) {}

  /**
   * Guarantee 2 of the roles spec: you may hand out only what you hold yourself. Without it anybody
   * allowed to assign could write themselves — or a colleague — a set containing every action and
   * climb the ladder in one request.
   *
   * It reads the target sets' actions from the database rather than a table in code, because since
   * R-3 a set is DATA: it can be built in the panel and its contents change without a deploy.
   *
   * Nobody meets it today — `roles.assign` is admin-only and the resolver hands `admin` every
   * action — and it is still built now, for the same reason `RolesService.assertActorHolds` was:
   * the moment assignment is delegated it is a hole, and by then there are sets in the wild.
   */
  private async assertActorMayGrant(
    roleCodes: readonly string[],
    actorPermissions: readonly Permission[],
  ): Promise<void> {
    const granted = await this.repo.findPermissionIdsForRoleCodes(roleCodes)
    const missing = [
      ...new Set(
        granted.filter((permission) => !actorPermissions.includes(permission as Permission)),
      ),
    ].sort()

    if (missing.length > 0) {
      throw new ForbiddenError(
        `Ne možeš dodeliti ovlašćenje koje sadrži radnju koju sam nemaš: ${missing.join(', ')}`,
      )
    }
  }

  private async revokeTargetSessionsAfterRoleChange(
    targetUserId: string,
    actorUserId: string,
  ): Promise<void> {
    if (targetUserId === actorUserId) return
    await this.userSessions.revokeAllForUser(targetUserId)
  }

  async list(query: UsersListQuery): Promise<UserListResponse> {
    return this.repo.list(query)
  }

  async updateAccountStatus(
    id: string,
    input: UserAccountStatusPatchInput,
    actor: HttpActorContext & { permissions: readonly Permission[] },
  ): Promise<UserAccountStatusResult> {
    if (id === actor.actorUserId) {
      throw new ForbiddenError('Ne možete menjati status sopstvenog naloga.')
    }

    const requiredPermission = permissionForStatus(input.status)
    if (!actor.permissions.includes(requiredPermission)) {
      throw new ForbiddenError()
    }

    const before = await this.repo.findAccountStatusById(id)
    if (before === null) {
      throw new NotFoundError('User', id)
    }

    if (before.accountStatus !== UserAccountStatus.Pending) {
      throw new ValidationError('Status naloga može menjati samo korisnik na čekanju.')
    }

    if (isProtectedSuperAdminEmail(before.email, this.protectedSuperAdminEmail)) {
      throw new ForbiddenError('Zaštićeni super-admin nalog ne može biti izmenjen.')
    }

    // Approving a client also links the user to customer(s); that is a separate,
    // named capability (docs/13) — require it on top of the approval permission.
    const approvesAsClient =
      input.status === UserAccountStatus.Approved && input.roleCodes.includes(SYSTEM_ROLE_CLIENT)

    if (approvesAsClient && !actor.permissions.includes('customers.link_users')) {
      throw new ForbiddenError()
    }

    if (input.status === UserAccountStatus.Approved) {
      await this.assertActorMayGrant(input.roleCodes, actor.permissions)
    }

    const updated =
      input.status === UserAccountStatus.Approved
        ? await this.repo.approvePendingUser(
            id,
            input.roleCodes,
            actor.actorUserId,
            input.customerIds,
          )
        : await this.repo.updateAccountStatus(id, input.status)

    const auditChanges =
      input.status === UserAccountStatus.Approved
        ? {
            before: {
              accountStatus: before.accountStatus,
              roles: sortedRoles(before.roles),
              // Kept for the trail: the value's purpose is consumed at approval
              // (the approver read it and picked the real firm), so this is a
              // record of what was typed, not a backup it could be restored from —
              // the audit row is written after the approval commits, not with it.
              requestedCompany: before.requestedCompany,
            },
            after: {
              accountStatus: updated.accountStatus,
              roles: sortedRoles(updated.roles),
              requestedCompany: updated.requestedCompany,
              ...(approvesAsClient ? { linkedCustomerIds: [...input.customerIds].sort() } : {}),
            },
          }
        : {
            before: { accountStatus: before.accountStatus },
            after: { accountStatus: updated.accountStatus },
          }

    await this.audit.log({
      entityType: 'user',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: auditChanges,
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Users)

    if (input.status === UserAccountStatus.Approved) {
      await this.revokeTargetSessionsAfterRoleChange(id, actor.actorUserId)
    }

    // Best-effort activation email (clients only). Runs AFTER the approval has
    // committed and is audited — a failed send never breaks the approval.
    let activationEmailSent: boolean | null = null
    if (approvesAsClient) {
      const activationUser = await this.repo.findActivationUserById(id)
      if (activationUser !== null) {
        activationEmailSent = await this.activation.sendActivationFor(activationUser)
      }
    }

    return { ...updated, activationEmailSent }
  }

  /** Resend the activation email for an approved client (invalidates older tokens). */
  async resendActivation(id: string, actor: HttpActorContext): Promise<{ sent: boolean }> {
    const target = await this.repo.findAccountStatusById(id)
    if (target === null) {
      throw new NotFoundError('User', id)
    }

    if (isProtectedSuperAdminEmail(target.email, this.protectedSuperAdminEmail)) {
      throw new ForbiddenError('Zaštićeni super-admin nalog ne može biti izmenjen.')
    }

    if (!target.roles.includes(SYSTEM_ROLE_CLIENT)) {
      throw new ValidationError('Aktivacioni link se šalje samo klijentima.')
    }

    if (target.accountStatus !== UserAccountStatus.Approved) {
      throw new UnprocessableEntityError(
        'Nalog mora biti odobren da bi se poslao aktivacioni link.',
      )
    }

    const activationUser = await this.repo.findActivationUserById(id)
    if (activationUser === null) {
      throw new NotFoundError('User', id)
    }

    const sent = await this.activation.sendActivationFor(activationUser)

    await this.audit.log({
      entityType: 'user',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { field: 'activation_email', action: 'resend', sent },
    })

    return { sent }
  }

  async replaceRoles(
    id: string,
    input: UserRolesReplaceInput,
    // Carries the actor's own actions, like `updateAccountStatus`: since R-6 the set being handed
    // out is data, so the server has to compare it against what the assigner holds.
    actor: HttpActorContext & { permissions: readonly Permission[] },
  ): Promise<UserListItem> {
    const target = await this.repo.findAccountStatusById(id)
    if (target === null) {
      throw new NotFoundError('User', id)
    }

    if (isProtectedSuperAdminEmail(target.email, this.protectedSuperAdminEmail)) {
      throw new ForbiddenError('Zaštićeni super-admin nalog ne može biti izmenjen.')
    }

    if (id === actor.actorUserId) {
      throw new ForbiddenError('Ne možete menjati sopstvene uloge.')
    }

    if (target.accountStatus !== UserAccountStatus.Approved) {
      throw new UnprocessableEntityError('Uloge se mogu dodeliti samo odobrenim korisnicima.')
    }

    await this.assertActorMayGrant(input.roleCodes, actor.permissions)

    const beforeRoles = sortedRoles(target.roles)
    const afterRoles = sortedRoles(input.roleCodes)

    const updated = await this.repo.replaceRoles(id, input.roleCodes, actor.actorUserId)

    await this.audit.log({
      entityType: 'user',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: {
        before: { roles: beforeRoles },
        after: { roles: afterRoles },
      },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Users)

    await this.revokeTargetSessionsAfterRoleChange(id, actor.actorUserId)

    return updated
  }

  async resetPassword(
    id: string,
    input: UserPasswordResetInput,
    actor: HttpActorContext,
  ): Promise<void> {
    const target = await this.repo.findAccountStatusById(id)
    if (target === null) {
      throw new NotFoundError('User', id)
    }

    if (isProtectedSuperAdminEmail(target.email, this.protectedSuperAdminEmail)) {
      throw new ForbiddenError('Zaštićeni super-admin nalog ne može biti izmenjen.')
    }

    if (id === actor.actorUserId) {
      throw new ForbiddenError('Sopstvenu lozinku menjate kroz standardni tok promene lozinke.')
    }

    await this.userPassword.setPassword(id, input.newPassword)

    // Force re-login everywhere with the new password.
    await this.userSessions.revokeAllForUser(id)

    // Audit the reset WITHOUT the password value.
    await this.audit.log({
      entityType: 'user',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { field: 'password', action: 'admin_reset' },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Users)
  }

  async setActive(
    id: string,
    input: UserSetActiveInput,
    actor: HttpActorContext,
  ): Promise<UserListItem> {
    const target = await this.repo.findAccountStatusById(id)
    if (target === null) {
      throw new NotFoundError('User', id)
    }

    if (isProtectedSuperAdminEmail(target.email, this.protectedSuperAdminEmail)) {
      throw new ForbiddenError('Zaštićeni super-admin nalog ne može biti izmenjen.')
    }

    if (id === actor.actorUserId) {
      throw new ForbiddenError('Ne možete deaktivirati sopstveni nalog.')
    }

    const updated = await this.repo.setActive(id, input.isActive)

    // Deactivation is the actual off-boarding step: it logs the user out
    // everywhere on their next request. The is-active login hook then blocks
    // any re-login until they are reactivated.
    if (!input.isActive) {
      await this.userSessions.revokeAllForUser(id)
    }

    await this.audit.log({
      entityType: 'user',
      entityId: id,
      action: input.isActive ? AuditAction.Restore : AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { field: 'isActive', after: input.isActive },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Users)

    return updated
  }
}
