import { AuditAction } from '@mr/shared'

import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { ExternalPartiesRepository } from './external-parties.repository.js'
import type {
  ExternalPartyCreateInput,
  ExternalPartyListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './external-parties.validators.js'

export type CreateExternalPartyActorContext = HttpActorContext

export class ExternalPartiesService {
  constructor(
    private readonly repo: ExternalPartiesRepository,
    private readonly audit: AuditPort,
  ) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ExternalPartyListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: ExternalPartyCreateInput,
    actor: HttpActorContext,
  ): Promise<ExternalPartyListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'external_party',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { after: created },
    })

    return created
  }
}
