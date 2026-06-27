import {
  AuditAction,
  ResourceChangedKey,
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
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { UsersRepository } from './users.repository.js'
import type {
  UserAccountStatusPatchInput,
  UserListItem,
  UserListResponse,
  UserRolesReplaceInput,
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
  ) {}

  async list(query: UsersListQuery): Promise<UserListResponse> {
    return this.repo.list(query)
  }

  async updateAccountStatus(
    id: string,
    input: UserAccountStatusPatchInput,
    actor: HttpActorContext & { permissions: readonly Permission[] },
  ): Promise<UserListItem> {
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

    const updated =
      input.status === UserAccountStatus.Approved
        ? await this.repo.approvePendingUser(id, input.roleCode, actor.actorUserId)
        : await this.repo.updateAccountStatus(id, input.status)

    const auditChanges =
      input.status === UserAccountStatus.Approved
        ? {
            before: { accountStatus: before.accountStatus, roles: sortedRoles(before.roles) },
            after: {
              accountStatus: updated.accountStatus,
              roles: sortedRoles(updated.roles),
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

    return updated
  }

  async replaceRoles(
    id: string,
    input: UserRolesReplaceInput,
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
      throw new ForbiddenError('Ne možete menjati sopstvene uloge.')
    }

    if (target.accountStatus !== UserAccountStatus.Approved) {
      throw new UnprocessableEntityError('Uloge se mogu dodeliti samo odobrenim korisnicima.')
    }

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

    return updated
  }
}
