import type { ClaimSourcesRepository } from './claim-sources.repository.js'
import type {
  ClaimSourceListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './claim-sources.validators.js'

export class ClaimSourcesService {
  constructor(private readonly repo: ClaimSourcesRepository) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<ClaimSourceListItem>> {
    return this.repo.list(query)
  }
}
