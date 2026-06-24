import type { Context } from 'hono'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import { ExcelExportInputSchema } from './excel.validators.js'
import type { ExcelActor } from './excel.types.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

function toActor(user: MRSessionUser): ExcelActor {
  return { id: user.id, permissions: user.permissions }
}

function buildAttachmentContentDisposition(fileName: string): string {
  const encoded = encodeURIComponent(fileName)
  return `attachment; filename="${fileName.replace(/"/g, '')}"; filename*=UTF-8''${encoded}`
}

export function createExcelController(container: Container): {
  exportWorkbook: (c: Context) => Promise<Response>
} {
  return {
    exportWorkbook: async (c: Context) => {
      const user = requireUser(c)
      const input = ExcelExportInputSchema.parse(await c.req.json())
      const result = await container.excelService.exportWorkbook(
        input,
        toActor(user),
        getActorContext(c, user),
      )

      return new Response(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': buildAttachmentContentDisposition(result.fileName),
          'Cache-Control': 'no-store',
        },
      })
    },
  }
}
