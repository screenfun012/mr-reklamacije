import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { AuditLogListQuerySchema } from './audit-log.validators.js'

export function createAuditLogController(container: Container) {
  return {
    list: async (c: Context) => {
      const query = AuditLogListQuerySchema.parse(c.req.query())
      const result = await container.auditLogService.list(query)
      return c.json(result)
    },
  }
}
