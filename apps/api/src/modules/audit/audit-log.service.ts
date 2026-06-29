import type { AuditLogRepository } from './audit-log.repository.js'
import type {
  AuditLogListItem,
  AuditLogListQuery,
  ReferenceListResponse,
} from './audit-log.validators.js'

/**
 * Read side of the audit trail. Reading the audit log is intentionally NOT
 * itself audited (it would flood the log with noise on every page view).
 */
export class AuditLogService {
  constructor(private readonly repo: AuditLogRepository) {}

  async list(query: AuditLogListQuery): Promise<ReferenceListResponse<AuditLogListItem>> {
    return this.repo.list(query)
  }
}
