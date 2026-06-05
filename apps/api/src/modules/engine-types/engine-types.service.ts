import { AuditAction } from '@mr/shared'

import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { EngineTypesRepository } from './engine-types.repository.js'
import type {
  EngineTypeCreateInput,
  EngineTypeListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './engine-types.validators.js'

export type CreateEngineTypeActorContext = HttpActorContext

export class EngineTypesService {
  constructor(
    private readonly repo: EngineTypesRepository,
    private readonly audit: AuditPort,
  ) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<EngineTypeListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: EngineTypeCreateInput,
    actor: HttpActorContext,
  ): Promise<EngineTypeListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'engine_type',
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
