import { AuditAction } from '@mr/shared'

import type { AuditService } from '../audit/audit.service.js'
import type { EngineTypesRepository } from './engine-types.repository.js'
import type {
  EngineTypeCreateInput,
  EngineTypeListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './engine-types.validators.js'

export interface CreateEngineTypeActorContext {
  actorUserId: string
  actorIp?: string | null
  actorUserAgent?: string | null
}

export class EngineTypesService {
  constructor(
    private readonly repo: EngineTypesRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<EngineTypeListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: EngineTypeCreateInput,
    actor: CreateEngineTypeActorContext,
  ): Promise<EngineTypeListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'engine_type',
      entityId: created.id,
      action: AuditAction.Create,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp ?? null,
      actorUserAgent: actor.actorUserAgent ?? null,
      changes: { after: created },
    })

    return created
  }
}
