import { AuditAction } from '@mr/shared'

import type { AuditService } from '../audit/audit.service.js'
import type { ExternalPartiesRepository } from './external-parties.repository.js'
import type {
  ExternalPartyCreateInput,
  ExternalPartyListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './external-parties.validators.js'

export interface CreateExternalPartyActorContext {
  actorUserId: string
  actorIp?: string | null
  actorUserAgent?: string | null
}

export class ExternalPartiesService {
  constructor(
    private readonly repo: ExternalPartiesRepository,
    private readonly audit: AuditService,
  ) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ExternalPartyListItem>> {
    return this.repo.list(query)
  }

  async create(
    input: ExternalPartyCreateInput,
    actor: CreateExternalPartyActorContext,
  ): Promise<ExternalPartyListItem> {
    const created = await this.repo.create(input)

    await this.audit.log({
      entityType: 'external_party',
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
