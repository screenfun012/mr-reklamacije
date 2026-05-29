import type { EmployeesRepository } from './employees.repository.js'
import type { EmployeeListItem, EmployeesListQuery, ReferenceListResponse } from './employees.validators.js'

export class EmployeesService {
  constructor(private readonly repo: EmployeesRepository) {}

  async list(query: EmployeesListQuery): Promise<ReferenceListResponse<EmployeeListItem>> {
    return this.repo.list(query)
  }
}
