import { schema } from '@mr/db'
import { ChatConversationType, type Permission } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer, createChatTestApp, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const OFFICE_PERMISSIONS = [
  'emotive_claims.view',
  'domace_claims.view',
] as const satisfies readonly Permission[]

const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1')

/**
 * A real mp4 as far as the shared pipeline is concerned — `ftyp` at 4, a brand at 8. That is the
 * point: the pipeline accepts it, and the chat must refuse it anyway. Without a whitelist of its
 * own, "photos and PDF" would be a claim made only by the browser's `accept` attribute.
 */
const MINIMAL_MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
])

function fileFrom(data: Buffer, name: string, type: string): File {
  return new File([new Uint8Array(data)], name, { type })
}

describe('Chat attachments — sending', () => {
  let ctx: TestDbContext
  let container: Container
  let app: ReturnType<typeof createChatTestApp>
  let generalId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    await ensureTestUser(ctx.db)

    /**
     * Read the seeded general channel if it is there, make it if it is not — the unique index keeps
     * it at one either way. `packages/auth` TRUNCATEs users CASCADE, which empties this table too,
     * so whether the seed survives here depends on which suite ran last.
     */
    const [existing] = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.type, ChatConversationType.General))
      .limit(1)
    generalId =
      existing?.id ??
      (
        await ctx.db
          .insert(schema.chatConversations)
          .values({ type: ChatConversationType.General, name: 'Opšti kanal' })
          .returning({ id: schema.chatConversations.id })
      )[0]?.id ??
      ''

    app = createChatTestApp(container, testUser([...OFFICE_PERMISSIONS]))
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function send(body: FormData): Promise<Response> {
    return app.request(`/api/chat/conversations/${generalId}/messages`, {
      method: 'POST',
      body,
    })
  }

  function form(fields: {
    clientMsgId: string
    body?: string
    files?: Array<{ data: Buffer; name: string; type: string }>
  }): FormData {
    const data = new FormData()
    data.set('clientMsgId', fields.clientMsgId)
    data.set('body', fields.body ?? '')
    for (const file of fields.files ?? []) {
      data.append('files', fileFrom(file.data, file.name, file.type))
    }
    return data
  }

  it('takes a photo with no words at all', async () => {
    const res = await send(
      form({
        clientMsgId: crypto.randomUUID(),
        files: [{ data: MINIMAL_JPEG, name: 'kvar.jpg', type: 'image/jpeg' }],
      }),
    )

    expect(res.status).toBe(201)
    const message = (await res.json()) as { body: string }
    expect(message.body).toBe('')
  })

  it('takes a PDF', async () => {
    const res = await send(
      form({
        clientMsgId: crypto.randomUUID(),
        body: 'evo računa',
        files: [{ data: MINIMAL_PDF, name: 'racun.pdf', type: 'application/pdf' }],
      }),
    )

    expect(res.status).toBe(201)
  })

  it('refuses a message that is neither words nor files', async () => {
    const res = await send(form({ clientMsgId: crypto.randomUUID() }))

    expect(res.status).toBe(400)
  })

  it('refuses a video, which the shared pipeline would happily accept', async () => {
    const res = await send(
      form({
        clientMsgId: crypto.randomUUID(),
        files: [{ data: MINIMAL_MP4, name: 'snimak.mp4', type: 'video/mp4' }],
      }),
    )

    expect(res.status).toBe(415)
  })

  it('refuses a sixth file', async () => {
    const res = await send(
      form({
        clientMsgId: crypto.randomUUID(),
        files: Array.from({ length: 6 }, (_, index) => ({
          data: MINIMAL_JPEG,
          name: `kvar-${index}.jpg`,
          type: 'image/jpeg',
        })),
      }),
    )

    expect(res.status).toBe(400)
  })

  /**
   * The whole reason files ride the send request instead of an upload-then-send pair: the
   * clientMsgId that already makes a retried message land once now covers its photos too.
   */
  it('answers a retried clientMsgId with 200 and stores no second copy', async () => {
    const clientMsgId = crypto.randomUUID()
    const files = [{ data: MINIMAL_JPEG, name: 'kvar.jpg', type: 'image/jpeg' }]

    const first = await send(form({ clientMsgId, body: 'evo', files }))
    expect(first.status).toBe(201)

    const second = await send(form({ clientMsgId, body: 'evo', files }))
    expect(second.status).toBe(200)

    const messages = await ctx.db
      .select({ id: schema.chatMessages.id })
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.conversationId, generalId))
    expect(messages).toHaveLength(1)

    const stored = await ctx.db
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(eq(schema.attachments.chatMessageId, messages[0]?.id ?? ''))
    expect(stored).toHaveLength(1)
  })

  it('still takes a plain JSON message, unchanged', async () => {
    const res = await app.request(`/api/chat/conversations/${generalId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientMsgId: crypto.randomUUID(), body: 'samo tekst' }),
    })

    expect(res.status).toBe(201)
  })
})
