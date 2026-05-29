import type { CustomersRepository } from './customers.repository.js'
import type {
  CustomerListItem,
  CustomersListQuery,
  ReferenceListResponse,
} from './customers.validators.js'

export class CustomersService {
  constructor(private readonly repo: CustomersRepository) {}

  async list(query: CustomersListQuery): Promise<ReferenceListResponse<CustomerListItem>> {
    return this.repo.list(query)
  }
}
