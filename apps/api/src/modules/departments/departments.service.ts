import type { DepartmentsRepository } from './departments.repository.js'
import type {
  DepartmentListItem,
  ReferenceListQuery,
  ReferenceListResponse,
} from './departments.validators.js'

export class DepartmentsService {
  constructor(private readonly repo: DepartmentsRepository) {}

  async list(query: ReferenceListQuery): Promise<ReferenceListResponse<DepartmentListItem>> {
    return this.repo.list(query)
  }
}
