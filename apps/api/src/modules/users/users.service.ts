import { AuditAction, ResourceChangedKey, UserAccountStatus, type Permission } from '@mr/shared'

import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { UsersRepository } from './users.repository.js'
import type {
  UserAccountStatusPatchInput,
  UserListItem,
  UserListResponse,
  UsersListQuery,
} from './users.validators.js'

function permissionForStatus(status: UserAccountStatusPatchInput['status']): Permission {
  return status === UserAccountStatus.Approved
    ? 'users.approve_registration'
    : 'users.reject_registration'
}

export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly audit: AuditPort,
    private readonly eventBus: EventBus,
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

    const updated = await this.repo.updateAccountStatus(id, input.status)

    await this.audit.log({
      entityType: 'user',
      entityId: id,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: {
        before: { accountStatus: before.accountStatus },
        after: { accountStatus: updated.accountStatus },
      },
    })

    this.eventBus.publishResourceChanged(ResourceChangedKey.Users)

    return updated
  }
}
