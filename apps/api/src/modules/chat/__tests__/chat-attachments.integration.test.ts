import { schema } from '@mr/db'
import { ChatConversationType, type Permission } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import type { UploadOpts } from '../../../infrastructure/storage/storage.interface.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
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

  it('rejects a clientMsgId already used in another conversation without storing its file', async () => {
    const clientMsgId = crypto.randomUUID()
    const [other] = await ctx.db
      .insert(schema.chatConversations)
      .values({
        type: ChatConversationType.Channel,
        name: 'Druga soba za isti ključ',
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.chatConversations.id })
    if (other === undefined) {
      throw new Error('second conversation was not created')
    }
    await ctx.db
      .insert(schema.chatMembers)
      .values({ conversationId: other.id, userId: TEST_USER_ID })

    const first = await send(
      form({
        clientMsgId,
        body: 'prva soba',
        files: [{ data: MINIMAL_PDF, name: 'prvi.pdf', type: 'application/pdf' }],
      }),
    )
    expect(first.status).toBe(201)
    const firstMessage = (await first.json()) as { id: string }
    const [firstAttachment] = await ctx.db
      .select({ storagePath: schema.attachments.storagePath })
      .from(schema.attachments)
      .where(eq(schema.attachments.chatMessageId, firstMessage.id))
    if (firstAttachment === undefined) {
      throw new Error('first attachment was not stored')
    }

    const uploadedElsewhere: string[] = []
    const upload = container.storageService.upload.bind(container.storageService)
    container.storageService.upload = async (opts: UploadOpts) => {
      uploadedElsewhere.push(opts.path)
      return upload(opts)
    }

    try {
      const second = await app.request(`/api/chat/conversations/${other.id}/messages`, {
        method: 'POST',
        body: form({
          clientMsgId,
          body: 'druga soba',
          files: [{ data: MINIMAL_PDF, name: 'drugi.pdf', type: 'application/pdf' }],
        }),
      })
      const response = (await second.json()) as { id?: string }

      expect(response.id).not.toBe(firstMessage.id)
      expect(second.status).toBe(409)
      expect(uploadedElsewhere).toEqual([])
      expect(await container.storageService.exists(firstAttachment.storagePath)).toBe(true)
      expect(
        await ctx.db
          .select({ id: schema.chatMessages.id })
          .from(schema.chatMessages)
          .where(eq(schema.chatMessages.conversationId, other.id)),
      ).toEqual([])
      expect(
        await ctx.db.select({ id: schema.notifications.id }).from(schema.notifications),
      ).toEqual([])
    } finally {
      container.storageService.upload = upload
      await container.storageService.delete(firstAttachment.storagePath)
    }
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

describe('Chat attachments — reading', () => {
  let ctx: TestDbContext
  let container: Container
  let officeApp: ReturnType<typeof createChatTestApp>
  let serviserApp: ReturnType<typeof createChatTestApp>
  let generalId: string
  let claimId: string
  let threadId: string
  let attachmentId: string
  let messageId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    await ensureTestUser(ctx.db)

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

    const [manufacturer] = await ctx.db
      .insert(schema.engineManufacturers)
      .values({ code: `CA-MFG-${Date.now()}`, name: 'Chat Attachments Mfg' })
      .returning({ id: schema.engineManufacturers.id })
    const [engineType] = await ctx.db
      .insert(schema.engineTypes)
      .values({ code: `CA-ENG-${Date.now()}`, manufacturerId: manufacturer?.id ?? '' })
      .returning({ id: schema.engineTypes.id })
    const [claim] = await ctx.db
      .insert(schema.emotiveClaims)
      .values({
        warrantyReport: 'Chat attachment claim',
        engineTypeId: engineType?.id ?? '',
        dateOfClaim: new Date('2026-08-24'),
        mrNumber: `MR-CA-${Date.now()}`,
        outcome: 'pending',
        claimYear: 2026,
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.emotiveClaims.id })
    claimId = claim?.id ?? ''
    const [thread] = await ctx.db
      .insert(schema.chatConversations)
      .values({
        type: ChatConversationType.Claim,
        emotiveClaimId: claimId,
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.chatConversations.id })
    threadId = thread?.id ?? ''

    officeApp = createChatTestApp(container, testUser([...OFFICE_PERMISSIONS]))
    // A serviser belongs in the internal app but may not read claims, so the thread is absent
    // for him — while the general channel is his like everyone else's.
    serviserApp = createChatTestApp(
      container,
      testUser(['intake_orders.view'], TEST_USER_ID, ['serviser']),
    )

    const data = new FormData()
    data.set('clientMsgId', crypto.randomUUID())
    data.set('body', 'evo kvara')
    data.append('files', fileFrom(MINIMAL_JPEG, 'kvar.jpg', 'image/jpeg'))
    const res = await officeApp.request(`/api/chat/conversations/${threadId}/messages`, {
      method: 'POST',
      body: data,
    })
    const message = (await res.json()) as { id: string }
    messageId = message.id

    const [row] = await ctx.db
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(eq(schema.attachments.chatMessageId, messageId))
    attachmentId = row?.id ?? ''
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('carries the file on the message the send itself answers with', async () => {
    // findMessageById, not listMessages — the send response is read straight into the screen, and
    // a resolver wired only into the list makes the photo appear one refresh late.
    const data = new FormData()
    data.set('clientMsgId', crypto.randomUUID())
    data.set('body', '')
    data.append('files', fileFrom(MINIMAL_JPEG, 'drugi.jpg', 'image/jpeg'))
    const res = await officeApp.request(`/api/chat/conversations/${threadId}/messages`, {
      method: 'POST',
      body: data,
    })

    const message = (await res.json()) as {
      attachments: Array<{ fileName: string; mimeType: string }>
    }
    expect(message.attachments).toHaveLength(1)
    expect(message.attachments[0]?.fileName).toBe('drugi.jpg')
    expect(message.attachments[0]?.mimeType).toBe('image/jpeg')
  })

  it('carries the file when the room is read back', async () => {
    const res = await officeApp.request(`/api/chat/conversations/${threadId}/messages`)
    const page = (await res.json()) as {
      items: Array<{ id: string; attachments: Array<{ fileName: string }> }>
    }

    const withFile = page.items.find((item) => item.id === messageId)
    expect(withFile?.attachments).toHaveLength(1)
  })

  /**
   * Taking a message back is the ONLY way to remove a file (Nikola, 2026-08-24), so the wire has to
   * honour it too — not just the download route. Without this the words vanish and the photo stays
   * sitting under "poruka je povučena".
   */
  it('drops the file from the wire once the message is taken back', async () => {
    await officeApp.request(`/api/chat/messages/${messageId}`, { method: 'DELETE' })

    const res = await officeApp.request(`/api/chat/conversations/${threadId}/messages`)
    const page = (await res.json()) as {
      items: Array<{ id: string; body: string; attachments: unknown[] }>
    }

    const withdrawn = page.items.find((item) => item.id === messageId)
    expect(withdrawn?.body).toBe('')
    expect(withdrawn?.attachments).toEqual([])
  })

  it('says a quoted photo-only message has one, so the block is not empty', async () => {
    const photoOnly = new FormData()
    photoOnly.set('clientMsgId', crypto.randomUUID())
    photoOnly.set('body', '')
    photoOnly.append('files', fileFrom(MINIMAL_JPEG, 'samo-slika.jpg', 'image/jpeg'))
    const posted = await officeApp.request(`/api/chat/conversations/${threadId}/messages`, {
      method: 'POST',
      body: photoOnly,
    })
    const { id: quotedId } = (await posted.json()) as { id: string }

    await officeApp.request(`/api/chat/conversations/${threadId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientMsgId: crypto.randomUUID(), body: 'da', quoteOf: quotedId }),
    })

    const res = await officeApp.request(`/api/chat/conversations/${threadId}/messages`)
    const page = (await res.json()) as {
      items: Array<{ quote: { excerpt: string; hasAttachment: boolean } | null }>
    }
    const reply = page.items.find((item) => item.quote !== null)
    expect(reply?.quote?.excerpt).toBe('')
    expect(reply?.quote?.hasAttachment).toBe(true)
  })

  it('serves the file through the room it was sent to', async () => {
    const res = await officeApp.request(
      `/api/chat/conversations/${threadId}/attachments/${attachmentId}`,
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).not.toBeNull()
  })

  it('keeps serving a file after the claim closes its thread', async () => {
    await ctx.db
      .update(schema.emotiveClaims)
      .set({ outcome: 'accepted' })
      .where(eq(schema.emotiveClaims.id, claimId))

    const res = await officeApp.request(
      `/api/chat/conversations/${threadId}/attachments/${attachmentId}`,
    )

    expect(res.status).toBe(200)
  })

  /**
   * The one that matters.
   *
   * Checking only "may this person open THIS conversation" is not enough: the general channel is
   * visible to everybody unconditionally, so a serviser — who sees no claim thread at all — could
   * ask for a claim thread's photo through the general channel and be handed it. The file has to
   * be resolved through its own message, in the same query.
   */
  it('refuses a file from a room the caller cannot see, asked for through one he can', async () => {
    const res = await serviserApp.request(
      `/api/chat/conversations/${generalId}/attachments/${attachmentId}`,
    )

    expect(res.status).toBe(404)
  })

  /**
   * The second gate, and it needs its own case.
   *
   * The query above binds the file to the room in the URL, which alone would hand this serviser
   * the photo — the room in the URL is the right one, he just may not read it. Removing
   * `requireVisible` leaves every other test in this file green, which is what "defence in depth"
   * means in practice: two layers, two cases.
   */
  it('refuses a file from a room the caller cannot see, asked for through that same room', async () => {
    const res = await serviserApp.request(
      `/api/chat/conversations/${threadId}/attachments/${attachmentId}`,
    )

    expect(res.status).toBe(404)
  })

  it('stops serving the file once the message is taken back', async () => {
    await officeApp.request(`/api/chat/messages/${messageId}`, { method: 'DELETE' })

    const res = await officeApp.request(
      `/api/chat/conversations/${threadId}/attachments/${attachmentId}`,
    )

    expect(res.status).toBe(404)
  })

  it('hands a download rather than an inline body when asked', async () => {
    const res = await officeApp.request(
      `/api/chat/conversations/${threadId}/attachments/${attachmentId}?disposition=attachment`,
    )

    expect(res.headers.get('content-disposition')).toContain('attachment')
  })

  /**
   * The portal half of the promise: a chat file is not a claim attachment, so the route that
   * serves claim files must not find it. Nothing in the claim queries can reach it either — a chat
   * row carries no claim id at all — but this is the one an actual customer session would try.
   */
  /**
   * Erasing a room is the ONE hard delete in this module, so it is also the one place attachment
   * rows disappear without anybody asking. The bytes have to go with them: after the cascade there
   * is no row left that could ever name those objects again, and they sit on a disk we pay for.
   */
  /**
   * The count has to come from the database.
   *
   * ⚠ The browser holds ONE page of fifty messages, so a shelf counted from the cache is wrong in
   * every room older than that — and wrong quietly, which is the worst kind.
   */
  it('counts every file in the room, not just the page the browser holds', async () => {
    // The room already has one file; add another on a second message.
    const second = new FormData()
    second.set('clientMsgId', crypto.randomUUID())
    second.set('body', '')
    second.append('files', fileFrom(MINIMAL_JPEG, 'drugi-kvar.jpg', 'image/jpeg'))
    await officeApp.request(`/api/chat/conversations/${threadId}/messages`, {
      method: 'POST',
      body: second,
    })

    const res = await officeApp.request(`/api/chat/conversations/${threadId}/attachments`)
    const shelf = (await res.json()) as {
      items: Array<{ id: string; fileName: string }>
      total: number
      pageSize: number
    }

    expect(res.status).toBe(200)
    expect(shelf.total).toBe(2)
    // Newest first — by the message's `seq`, the one thing in a room that genuinely increases.
    // ⚠ NOT by `uploaded_at`: that defaults to now(), which is the TRANSACTION's clock, so every
    // file of one message shares it and the sort falls through to a random uuid.
    expect(shelf.items.map((item) => item.fileName)).toEqual(['drugi-kvar.jpg', 'kvar.jpg'])
  })

  it('keeps a withdrawn message off the shelf', async () => {
    await officeApp.request(`/api/chat/messages/${messageId}`, { method: 'DELETE' })

    const res = await officeApp.request(`/api/chat/conversations/${threadId}/attachments`)
    const shelf = (await res.json()) as { total: number }
    expect(shelf.total).toBe(0)
  })

  it('404s the shelf of a room the caller cannot see', async () => {
    const res = await serviserApp.request(`/api/chat/conversations/${threadId}/attachments`)
    expect(res.status).toBe(404)
  })

  it('takes the files off the disk when the room is erased', async () => {
    const [row] = await ctx.db
      .select({ storagePath: schema.attachments.storagePath })
      .from(schema.attachments)
      .where(eq(schema.attachments.id, attachmentId))
    const storagePath = row?.storagePath ?? ''
    await expect(container.storageService.readStream(storagePath)).resolves.toBeDefined()

    await container.chatService.deleteConversation(threadId, {
      id: TEST_USER_ID,
      permissions: [...OFFICE_PERMISSIONS],
      roles: ['admin'],
    })

    await expect(container.storageService.readStream(storagePath)).rejects.toThrow()
  })

  it('is invisible to the claim-attachment download path', async () => {
    await expect(
      container.attachmentsService.getDownloadMeta(
        attachmentId,
        { id: TEST_USER_ID, permissions: ['attachments.view_client_visible'] },
        'original',
      ),
    ).rejects.toThrow()
  })
})

/**
 * Who a phone hears from.
 *
 * ⚠ The muting is decided HERE, in the chat's own query, and not in the push module. `chat_mutes`
 * is the chat's promise that a room will not disturb you — and a lock screen is the worst possible
 * place to break it.
 */
describe('Chat push — who is on the list', () => {
  let ctx: TestDbContext
  let container: Container
  let generalId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    await ensureTestUser(ctx.db)

    /*
     * ⚠ The account has to be LIVE and hold a ROLE, or none of this proves anything.
     *
     * `listPeopleFor` joins through `user_roles` and requires `is_active` + `approved`
     * (`isLiveAccount`). Without this the test user is simply absent from every list, and
     * "the author is not on it" would pass because he was unreachable — not because he was
     * excluded. That exact trap was recorded on 2026-08-23 and it caught this test too.
     */
    await ctx.db
      .update(schema.users)
      .set({ isActive: true, accountStatus: 'approved' })
      .where(eq(schema.users.id, TEST_USER_ID))
    // The admin role short-circuits the permission join in `listPeopleFor`. Made here rather than
    // borrowed from the seed: whether the seed survived depends on which suite ran last, and a
    // fixture that is found rather than made is how a suite passes on a laptop and dies in CI.
    const [existingRole] = await ctx.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, 'admin'))
      .limit(1)
    const roleId =
      existingRole?.id ??
      (
        await ctx.db
          .insert(schema.roles)
          .values({
            code: 'admin',
            nameSr: 'Administrator',
            nameEn: 'Administrator',
            isSystem: true,
          })
          .returning({ id: schema.roles.id })
      )[0]?.id
    if (roleId === undefined) {
      throw new Error('no admin role')
    }
    await ctx.db
      .insert(schema.userRoles)
      // assignedBy is NOT NULL and self-assignment is the bootstrap pattern this repo already uses.
      .values({ userId: TEST_USER_ID, roleId, assignedBy: TEST_USER_ID })
      .onConflictDoNothing()

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
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function conversation() {
    const list = await container.chatService.listConversations({
      id: TEST_USER_ID,
      permissions: [...OFFICE_PERMISSIONS],
      roles: ['operator'],
    })
    const found = list.items.find((item) => item.id === generalId)
    if (found === undefined) {
      throw new Error('general channel not visible')
    }
    return found
  }

  it('never puts the author on it', async () => {
    const recipients = await container.chatRepository.listPushRecipients(
      await conversation(),
      TEST_USER_ID,
    )

    expect(recipients).not.toContain(TEST_USER_ID)
  })

  it('takes a muted room off it', async () => {
    const room = await conversation()

    const before = await container.chatRepository.listPushRecipients(room, 'someone-else')
    expect(before).toContain(TEST_USER_ID)

    await ctx.db
      .insert(schema.chatMutes)
      .values({ conversationId: generalId, userId: TEST_USER_ID })

    const after = await container.chatRepository.listPushRecipients(room, 'someone-else')
    expect(after).not.toContain(TEST_USER_ID)
  })
})
