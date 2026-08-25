import type { Logger } from '@mr/logger'
import {
  CHAT_CONTEXT_ATTACHMENTS_SHOWN,
  CHAT_EDIT_WINDOW_MS,
  CHAT_MENTION_EXCERPT_MAX,
  CHAT_PINS_MAX,
  AuditAction,
  ChatConversationType,
  ChatSystemKind,
  ClaimKind,
  ClaimOutcome,
  getInitials,
  INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS,
  INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS,
  MENTION_EVERYONE_ID,
  stripMentionMarkup,
  SYSTEM_ROLE_ADMIN,
  uniqueMentions,
  type ChatConversationAttachmentsResponse,
  type ChatChannelManagementListResponse,
  type ChatClaimThreadLookup,
  type ChatMembersResponse,
  type ChatPin,
} from '@mr/shared'

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../core/errors/domain-errors.js'
import type { ChatPort, ChatSystemMessageTarget } from '../../core/ports/chat-port.js'
import type { EventBus } from '../../core/ports/event-bus-port.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { NotificationsPort } from '../../core/ports/notifications-port.js'
import {
  resolveAttachmentDownloadMeta,
  type AttachmentDownloadMeta,
} from '../../core/attachments/attachment-download-meta.js'
import type { PushPort } from '../../core/ports/push-port.js'
import type { ChatAttachmentsService, PreparedChatFile } from './chat-attachments.service.js'
import type { ChatRepository, ChatVisibilityScope } from './chat.repository.js'
import type {
  ChatActor,
  ChatChannelCreateInput,
  ChatChannelManagementQuery,
  ChatConversationListItem,
  ChatConversationListResponse,
  ChatMessage,
  ChatPeopleResponse,
  ChatMessagesPage,
  ChatMessagesQuery,
  ChatSendInput,
} from './chat.validators.js'

/** `created` is what separates 201 from 200 — a retry stored nothing and must not claim it did. */
export interface ChatSendResult {
  message: ChatMessage
  created: boolean
  /**
   * How many of the message's files were lost on the way to storage. Zero on every ordinary send.
   *
   * The words are already posted by then, so one unwritable photo must not take the sentence down
   * with it — the screen offers to send the missing ones again, as a NEW message. Retrying under
   * the same clientMsgId would answer 200 and drop the bytes, which is how a photo becomes
   * unrecoverable.
   */
  partialFiles: number
}

/** Same distinction for a thread: 201 the first time somebody opens it, 200 every time after. */
export interface ChatThreadResult {
  conversation: ChatConversationListItem
  created: boolean
}

function holdsAny(actor: ChatActor, permissions: readonly string[]): boolean {
  return permissions.some((permission) => actor.permissions.includes(permission))
}

/**
 * ⚠ The INTERNAL sets, and nothing else.
 *
 * A claim thread is an internal conversation about a claim, so it follows the permission that
 * opens the claim on an INTERNAL screen. `emotive_claims.view_own_customer` is the portal
 * client's permission — reading it here would hand him the shop's own conversations. Spec §3.3.
 */
/**
 * A thread whose claim has been decided takes no more words (Nikola, 2026-08-23).
 *
 * ⚠ 422, not 403: nothing is wrong with WHO is asking — the room itself is closed, and it opens
 * again the moment the claim goes back to pending. The message says so rather than making somebody
 * guess which of the two it was.
 */
function requireOpen(conversation: ChatConversationListItem): void {
  if (conversation.isLocked) {
    throw new UnprocessableEntityError('This claim is decided, so its conversation is closed')
  }
}

function scopeFor(actor: ChatActor): ChatVisibilityScope {
  return {
    userId: actor.id,
    canReadEmotiveClaims: holdsAny(actor, INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS),
    canReadDomaceClaims: holdsAny(actor, INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS),
  }
}

export class ChatService implements ChatPort {
  constructor(
    private readonly repo: ChatRepository,
    private readonly events: EventBus,
    private readonly logger: Logger,
    private readonly notifications: NotificationsPort,
    private readonly audit: AuditPort,
    private readonly attachments: ChatAttachmentsService,
    private readonly push: PushPort,
  ) {}

  async listConversations(actor: ChatActor): Promise<ChatConversationListResponse> {
    const items = await this.repo.listConversations(scopeFor(actor))

    return {
      items,
      // Task 5 sums the unread numbers here, muted conversations excluded.
      unreadTotal: items.reduce((total, item) => total + (item.isMuted ? 0 : item.unreadCount), 0),
    }
  }

  async listMessages(
    conversationId: string,
    query: ChatMessagesQuery,
    actor: ChatActor,
  ): Promise<ChatMessagesPage> {
    const conversation = await this.requireVisible(conversationId, actor)

    return this.repo.listMessages(conversation, query)
  }

  /**
   * Only a member may post, and "member" is the same visible set the reads use — a conversation
   * he cannot read is one he cannot write into, and it answers 404 rather than 403.
   */
  async send(
    conversationId: string,
    input: ChatSendInput,
    actor: ChatActor,
    files: readonly PreparedChatFile[] = [],
  ): Promise<ChatSendResult> {
    const conversation = await this.requireVisible(conversationId, actor)
    requireOpen(conversation)

    /**
     * A photo on its own IS a message (Nikola, 2026-08-24), so the body may be empty — but only
     * when something else arrived with it. The rule lives here rather than in the Zod schema
     * because this is the first place the parsed input and the processed files are both in hand:
     * the files come as multipart and the schema never sees them.
     */
    if (input.body === '' && files.length === 0) {
      throw new ValidationError('A message needs words or a file')
    }

    /**
     * A quote must point INSIDE this conversation. The foreign key only proves the message
     * exists — it would happily accept one from a thread the sender cannot open, and the row
     * would then carry a pointer nothing can render and nobody meant to make.
     */
    if (input.quoteOf !== undefined) {
      const quoted = await this.repo.findMessageById(input.quoteOf)
      if (quoted === null || quoted.conversationId !== conversationId) {
        throw new NotFoundError('Chat message', input.quoteOf)
      }
    }

    const stored = await this.repo.insertMessage({
      conversationId,
      authorId: actor.id,
      clientMsgId: input.clientMsgId,
      body: input.body,
      quoteOf: input.quoteOf ?? null,
    })
    if (stored === null) {
      throw new ConflictError('Chat message could not be stored')
    }

    /**
     * Only a message that was actually created gets its files written.
     *
     * A retry finds the message already there, so these bytes are dropped and nothing reaches the
     * disk — which is why the files ride the send request instead of an upload-then-send pair: the
     * clientMsgId that already makes a retried message land once now covers its photos too.
     */
    let partialFiles = 0
    if (stored.created && files.length > 0) {
      const written = await this.attachments.store(conversationId, stored.id, files)
      partialFiles = written.failed
    }

    const message = await this.repo.findMessageById(stored.id)
    if (message === null) {
      throw new NotFoundError('Chat message', stored.id)
    }

    // A retry wrote nothing, so it announces nothing — one message, one signal.
    if (stored.created) {
      this.announce(conversationId, message.id)
      await this.ringMentions(conversation, message, actor)
      this.pushToPhones(conversation, message, actor)
    }

    return { message, created: stored.created, partialFiles }
  }

  /** The room's shelf of files. Same gate as everything else here: 404 for a room he cannot read. */
  async listAttachments(
    conversationId: string,
    actor: ChatActor,
  ): Promise<ChatConversationAttachmentsResponse> {
    await this.requireVisible(conversationId, actor)

    const { items, total } = await this.repo.listConversationAttachments(
      conversationId,
      CHAT_CONTEXT_ATTACHMENTS_SHOWN,
    )

    return { items, total, page: 1, pageSize: CHAT_CONTEXT_ATTACHMENTS_SHOWN }
  }

  /**
   * What to serve for one file in one room.
   *
   * Two gates, deliberately both: `requireVisible` answers 404 for a room he may not read, and the
   * repository query then resolves the file through its own message so a room he MAY read cannot
   * be used as a doorway into one he may not.
   */
  async attachmentDownloadMeta(
    conversationId: string,
    attachmentId: string,
    actor: ChatActor,
    variant: 'original' | 'thumbnail',
  ): Promise<AttachmentDownloadMeta> {
    await this.requireVisible(conversationId, actor)

    const row = await this.repo.findChatAttachment(conversationId, attachmentId)
    if (row === null) {
      throw new NotFoundError('Chat attachment', attachmentId)
    }

    return resolveAttachmentDownloadMeta(row, variant)
  }

  /**
   * Tells the phones. Every message, not only the mentions — Nikola, 2026-08-23, and the reason is
   * his: a person who is flooded turns notifications off in the PHONE and loses the mentions too,
   * so the switch that thins them out lives in the app.
   *
   * ⚠ Fire-and-forget with a `.catch()`, and the catch is not politeness. Node 24 runs
   * `--unhandled-rejections=throw` and this API registers no handler for it, so one push service
   * having a bad day would take the whole service down. `PushPort` promises never to reject; this
   * is what makes that promise not be the only thing standing there.
   */
  private pushToPhones(
    conversation: ChatConversationListItem,
    message: ChatMessage,
    actor: ChatActor,
  ): void {
    void this.deliverPush(conversation, message, actor).catch((error: unknown) => {
      this.logger.error({ err: error }, 'chat push fan-out failed')
    })
  }

  private async deliverPush(
    conversation: ChatConversationListItem,
    message: ChatMessage,
    actor: ChatActor,
  ): Promise<void> {
    if (!this.push.isEnabled) {
      return
    }

    // ⚠ The muted are filtered out HERE, in the chat's own query — `chat_mutes` is the chat's
    // promise that a room will not disturb you, and a lock screen is the worst place to break it.
    const recipientIds = await this.repo.listPushRecipients(conversation, actor.id)
    if (recipientIds.length === 0) {
      return
    }

    await this.push.notifyChatMessage({
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      authorName: message.author?.name ?? '',
      excerpt: stripMentionMarkup(message.body).slice(0, CHAT_MENTION_EXCERPT_MAX),
      mentionedUserIds: uniqueMentions(message.body).map((mention) => mention.id),
      recipientIds,
    })
  }

  /**
   * Rings everybody this message names.
   *
   * ⚠ Named AND able to see the room. A mention of somebody who cannot read this conversation is
   * written down and simply not delivered (spec §5 row 7) — the message is never refused over an
   * address, because permissions change after words are written and the words are the point.
   *
   * `@svi` means everybody who can see it. Somebody caught by both `@svi` and their own name is
   * one recipient, not two — and the author is never one of them.
   *
   * Best-effort by construction: `notifyChatMention` swallows its own failures, because a bell is
   * not worth failing a message over.
   */
  private async ringMentions(
    conversation: ChatConversationListItem,
    message: ChatMessage,
    actor: ChatActor,
  ): Promise<void> {
    const mentions = uniqueMentions(message.body)
    if (mentions.length === 0) {
      return
    }

    const people = await this.repo.listPeopleFor(conversation)
    const namesEverybody = mentions.some((mention) => mention.id === MENTION_EVERYONE_ID)
    const reachable = new Set(people.map((person) => person.id))
    // ⚠ The author is NOT dropped here. Every `NotificationsPort` method promises to exclude the
    // acting user, and that promise is worth more as one place than as two — with the filter in
    // both, breaking either leaves the other standing and no test can tell which one works.
    const recipientIds = namesEverybody
      ? people.map((person) => person.id)
      : mentions.map((mention) => mention.id).filter((id) => reachable.has(id))

    if (recipientIds.length === 0) {
      return
    }

    await this.notifications.notifyChatMention(actor.id, {
      messageId: message.id,
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      authorName: message.author?.name ?? '',
      excerpt: stripMentionMarkup(message.body).slice(0, CHAT_MENTION_EXCERPT_MAX),
      recipientIds: [...new Set(recipientIds)],
    })
  }

  /**
   * The claim's one thread, opened if it is not there yet — whatever door you came through, the
   * detail's tab or an MR number in somebody's message, this is the same room.
   */
  async threadForClaim(
    kind: ClaimKind,
    claimId: string,
    actor: ChatActor,
  ): Promise<ChatThreadResult> {
    const scope = scopeFor(actor)

    /**
     * ⚠ The whole guard of this endpoint. A thread is an internal conversation ABOUT a claim, so
     * whoever may not open the claim on an internal screen may not open its thread — and gets a
     * 404 rather than a 403, because a 403 would tell him the claim is there.
     */
    const mayRead =
      kind === ClaimKind.Emotive ? scope.canReadEmotiveClaims : scope.canReadDomaceClaims
    if (!mayRead) {
      throw new NotFoundError('Claim', claimId)
    }

    const opened = await this.repo.openClaimThread(kind, claimId, actor.id)
    if (opened.status === 'not_found') {
      throw new NotFoundError('Claim', claimId)
    }
    if (opened.status === 'closed') {
      throw new UnprocessableEntityError('This claim is decided, so its conversation is closed')
    }

    const conversation = await this.repo.findVisibleConversation(opened.conversationId, scope)
    if (conversation === null) {
      throw new NotFoundError('Chat conversation', opened.conversationId)
    }

    if (opened.messageId !== null) {
      this.announce(opened.conversationId, opened.messageId)
    }

    return { conversation, created: opened.created }
  }

  /** Looks up the claim's thread without creating anything. */
  async findThreadForClaim(
    kind: ClaimKind,
    claimId: string,
    actor: ChatActor,
  ): Promise<ChatClaimThreadLookup> {
    const scope = scopeFor(actor)
    const mayRead =
      kind === ClaimKind.Emotive ? scope.canReadEmotiveClaims : scope.canReadDomaceClaims
    if (!mayRead) {
      throw new NotFoundError('Claim', claimId)
    }

    const outcome = await this.repo.findClaimOutcome(kind, claimId)
    if (outcome === null) {
      throw new NotFoundError('Claim', claimId)
    }

    const conversation = await this.repo.findVisibleClaimThread(kind, claimId, scope)
    return {
      conversation,
      canCreateThread: conversation === null && outcome === ClaimOutcome.Pending,
    }
  }

  /**
   * `ChatPort`: what the shop did, recorded in the claim's thread. Never throws back at the caller
   * — the claim is already written, audited and announced, and a note about it is not worth
   * turning that into a 500.
   */
  async postSystemMessage(
    target: ChatSystemMessageTarget,
    systemKind: ChatSystemKind,
    meta: Record<string, string>,
  ): Promise<void> {
    try {
      const conversationId = await this.repo.findClaimThreadId(target.kind, target.claimId)
      // ⚠ No thread, no message. A system event NEVER creates one (spec §5 row 9): nothing in
      // this app appears without somebody asking for it, so the event is dropped on purpose.
      if (conversationId === null) {
        return
      }

      await this.writeSystemMessage(conversationId, systemKind, meta)
    } catch (error) {
      this.logger.error({ err: error }, 'Chat system message failed')
    }
  }

  private async writeSystemMessage(
    conversationId: string,
    systemKind: ChatSystemKind,
    meta: Record<string, string>,
  ): Promise<void> {
    const message = await this.repo.insertSystemMessage(conversationId, systemKind, meta)
    if (message !== null) {
      this.announce(conversationId, message.id)
    }
  }

  /**
   * A typo, fixed. Only by the person who wrote it, and only while it is still a typo rather than
   * a rewritten record — the messages are evidence for a claim (spec §5 row 4).
   */
  async editMessage(messageId: string, body: string, actor: ChatActor): Promise<ChatMessage> {
    const { message, conversation } = await this.requireVisibleMessage(messageId, actor)
    requireOpen(conversation)

    // A system message has no author, so it fails here too — and that is exactly the intent.
    if (message.author?.id !== actor.id) {
      throw new ForbiddenError('A message is corrected only by the person who wrote it')
    }
    if (message.deletedAt !== null) {
      throw new UnprocessableEntityError('A message that was taken back is not corrected')
    }
    if (Date.now() - Date.parse(message.createdAt) > CHAT_EDIT_WINDOW_MS) {
      throw new UnprocessableEntityError('The time to correct this message has passed')
    }

    await this.repo.updateMessageBody(messageId, body)
    // Same reason as the withdrawal above: a correction nobody else sees is not a correction.
    this.announce(message.conversationId, messageId)

    const updated = await this.repo.findMessageById(messageId)
    if (updated === null) {
      throw new NotFoundError('Chat message', messageId)
    }

    // A correction may ADD a name (Nikola, 23.08.), and that name has not heard anything yet.
    // Anybody the first version already rang is skipped inside the fan-out, so the same person
    // never hears the same message twice however often it is corrected.
    await this.ringMentions(conversation, updated, actor)

    return updated
  }

  /**
   * Taken back, not erased: the row keeps its `seq` — which every read marker and every recovery
   * window is counted against — and the words stop being served. Twice in a row is once.
   */
  async deleteMessage(messageId: string, actor: ChatActor): Promise<void> {
    const { message, conversation } = await this.requireVisibleMessage(messageId, actor)
    requireOpen(conversation)

    if (message.author?.id !== actor.id) {
      throw new ForbiddenError('A message is taken back only by the person who wrote it')
    }
    if (message.deletedAt !== null) {
      return
    }

    await this.repo.softDeleteMessage(messageId)
    /*
     * ⚠ Taking a message back has to reach the OTHER screens, and until now it did not.
     *
     * Every other action here announces — sending, pinning, unpinning, liking, unliking — and a
     * withdrawal was the one that did not. So a thumbs-up travelled to all fifty browsers while
     * taking back a photo sent to the wrong room travelled to none: it stayed on everybody's screen
     * until they navigated away, and permanently once the room moved past the twenty-row recovery
     * window. The server was right all along (the bytes 404); only the screens were wrong, and in
     * the direction that hurts.
     */
    this.announce(message.conversationId, messageId)
  }

  /** Per account, not per browser: it has to survive the tablet being swapped (spec §5). */
  async mute(conversationId: string, actor: ChatActor): Promise<void> {
    await this.requireVisible(conversationId, actor)

    await this.repo.insertMute(conversationId, actor.id)
  }

  async unmute(conversationId: string, actor: ChatActor): Promise<void> {
    await this.requireVisible(conversationId, actor)

    await this.repo.deleteMute(conversationId, actor.id)
  }

  /**
   * Pins are a shortlist, not a second inbox — hence the cap. Pinning what is already pinned is
   * NOT refused at the cap: a retry must not be the one request that fails.
   */
  async pin(messageId: string, actor: ChatActor): Promise<void> {
    const { message, conversation } = await this.requireVisibleMessage(messageId, actor)
    requireOpen(conversation)

    if ((await this.repo.findPin(message.conversationId, messageId)) !== null) {
      return
    }
    if ((await this.repo.countPins(message.conversationId)) >= CHAT_PINS_MAX) {
      throw new ConflictError(
        `A conversation keeps at most ${String(CHAT_PINS_MAX)} pinned messages`,
      )
    }

    await this.repo.insertPin(message.conversationId, messageId, actor.id)
    this.announce(message.conversationId, messageId)
  }

  /**
   * Whoever pinned it takes it down, and an admin can take down anybody's — the same rule the spec
   * gives a channel (§5 rows 6 and 11). It is written as a ROLE and not a permission because chat
   * has none of its own (N4: no new permission), and `admin` is the role this repo already reads
   * directly where the concept IS the role.
   */
  async unpin(messageId: string, actor: ChatActor): Promise<void> {
    const { message, conversation } = await this.requireVisibleMessage(messageId, actor)
    requireOpen(conversation)

    const pin = await this.repo.findPin(message.conversationId, messageId)
    if (pin === null) {
      return
    }
    if (pin.pinnedBy !== actor.id && !actor.roles.includes(SYSTEM_ROLE_ADMIN)) {
      throw new ForbiddenError('A pin is taken down by the person who put it there, or by an admin')
    }

    await this.repo.deletePin(message.conversationId, messageId)
    this.announce(message.conversationId, messageId)
  }

  /** One tick, one person, one message. There is no emoji to choose (spec §5 row 10). */
  async react(messageId: string, actor: ChatActor): Promise<void> {
    const { message, conversation } = await this.requireVisibleMessage(messageId, actor)
    requireOpen(conversation)

    await this.repo.insertReaction(messageId, actor.id)
    this.announce(message.conversationId, messageId)
  }

  async unreact(messageId: string, actor: ChatActor): Promise<void> {
    const { message, conversation } = await this.requireVisibleMessage(messageId, actor)
    requireOpen(conversation)

    await this.repo.deleteReaction(messageId, actor.id)
    this.announce(message.conversationId, messageId)
  }

  /** The shortlist. Whoever may read the room may read what is pinned in it — nothing else to say. */
  async listPins(conversationId: string, actor: ChatActor): Promise<ChatPin[]> {
    await this.requireVisible(conversationId, actor)

    return this.repo.listPins(conversationId)
  }

  /** No audit entry: how far someone has read is view-tracking, not a business state change. */
  async markRead(conversationId: string, lastSeq: bigint, actor: ChatActor): Promise<void> {
    await this.requireVisible(conversationId, actor)

    await this.repo.markRead(conversationId, actor.id, lastSeq)
  }

  /**
   * Best-effort, after the write, and it never throws back at the sender: the write is already
   * stored, and a bus that is down must not turn it into a 500. The listeners recover on their
   * next read anyway — that is what the overlapping recovery window is for. Same rule as
   * `fanOut()` in the notifications service.
   *
   * ⚠ Also published by a tick and by a pin, which create no message. It is deliberately the SAME
   * signal: the client's only reaction to it is "re-read this room", which is exactly right for
   * all three, and a second event type for a checkmark would be nine files (CLAUDE.md §2 counts
   * five of them, and the ports and buses are the rest) for something no listener would treat
   * differently. Nothing downstream infers "a message arrived" from it — unread is counted from
   * `chat_reads`, and the bell is the notifications module's own.
   */
  private announce(conversationId: string, messageId: string): void {
    try {
      this.events.publishChatMessageCreated(conversationId, messageId)
    } catch (error) {
      this.logger.error({ err: error }, 'Chat message signal failed')
    }
  }

  /** ⚠ On EVERY channel route, not only on delete: it is the one room that exists for everybody. */
  private requireRealChannel(conversation: ChatConversationListItem): void {
    if (conversation.type === ChatConversationType.General) {
      throw new UnprocessableEntityError('The general channel is not managed')
    }
    if (conversation.type !== ChatConversationType.Channel) {
      throw new UnprocessableEntityError('This is not a channel')
    }
  }

  private async metadataAccess(
    conversationId: string,
    actor: ChatActor,
  ): Promise<{ conversation: ChatConversationListItem; canManage: boolean }> {
    const scope = scopeFor(actor)
    const manageable = await this.repo.findManageableChannel(
      conversationId,
      actor.id,
      actor.roles.includes(SYSTEM_ROLE_ADMIN),
      scope,
    )
    if (manageable !== null) {
      return { conversation: manageable, canManage: true }
    }

    const visible = await this.requireVisible(conversationId, actor)
    this.requireRealChannel(visible)
    return { conversation: visible, canManage: false }
  }

  private async requireChannelManager(
    conversationId: string,
    actor: ChatActor,
  ): Promise<ChatConversationListItem> {
    const access = await this.metadataAccess(conversationId, actor)
    if (!access.canManage) {
      throw new ForbiddenError('A channel is managed by whoever made it')
    }
    return access.conversation
  }

  /**
   * Makes a channel. Anybody in the chat may (Nikola, 2026-08-24) — the same as opening a claim's
   * thread, and for the same reason: a room is work, not a privilege. A surplus one is deleted.
   */
  async createChannel(
    input: ChatChannelCreateInput,
    actor: ChatActor,
  ): Promise<ChatConversationListItem> {
    const { conversationId } = await this.repo.createChannel(input, actor.id)
    this.announce(conversationId, conversationId)

    const conversation = await this.repo.findVisibleConversation(conversationId, scopeFor(actor))
    if (conversation === null) {
      throw new NotFoundError('Chat conversation', conversationId)
    }

    return conversation
  }

  async listManagedChannels(
    query: ChatChannelManagementQuery,
    actor: ChatActor,
  ): Promise<ChatChannelManagementListResponse> {
    return this.repo.listManagedChannels(actor.id, actor.roles.includes(SYSTEM_ROLE_ADMIN), query)
  }

  async renameChannel(conversationId: string, name: string, actor: ChatActor): Promise<void> {
    await this.requireChannelManager(conversationId, actor)

    await this.repo.renameChannel(conversationId, name)
    this.announce(conversationId, conversationId)
  }

  async listMembers(conversationId: string, actor: ChatActor): Promise<ChatMembersResponse> {
    const { canManage } = await this.metadataAccess(conversationId, actor)

    return {
      members: await this.repo.listMembers(conversationId),
      // ⚠ Its own query: `listPeopleFor` answers "who may a mention name here", which for a channel
      // is its members — reusing it would offer only the people already inside.
      addable: canManage ? await this.repo.listAddableUsers(conversationId) : [],
      canManage,
    }
  }

  async addMembers(
    conversationId: string,
    userIds: readonly string[],
    actor: ChatActor,
  ): Promise<void> {
    await this.requireChannelManager(conversationId, actor)

    await this.repo.addMembers(conversationId, userIds)
    this.announce(conversationId, conversationId)
  }

  /**
   * Taking somebody out — or walking out yourself.
   *
   * ⚠ Leaving needs no ownership: anybody may leave any room they are in. Which is exactly how a
   * channel ends up with nobody in it, and why an admin can see an empty one.
   */
  async removeMember(conversationId: string, userId: string, actor: ChatActor): Promise<void> {
    const { canManage } = await this.metadataAccess(conversationId, actor)

    if (userId !== actor.id && !canManage) {
      throw new ForbiddenError('A channel is managed by whoever made it')
    }

    await this.repo.removeMember(conversationId, userId)
    this.announce(conversationId, conversationId)
  }

  /**
   * Erases a room, for an admin and nobody else.
   *
   * Nikola, 2026-08-23: "ako neko napravi kanal ili nit bez razloga slucajno … ja kao admin mogu da
   * je obrisem skroz znaci kao da nikada nije bila". So this is for a MISTAKE, not for tidying
   * history — the precedent is `intake_orders.delete_signed`, where a wrongly made record goes and
   * only the audit row is left to say it existed.
   *
   * ⚠ By ROLE, not by a permission: the chat deliberately has none of its own (spec N4), and `unpin`
   * already reads the admin role the same way.
   *
   * ⚠ The general channel is refused. It is a system seed, every screen assumes it is there, and it
   * cannot be made again from inside the app.
   */
  async deleteConversation(conversationId: string, actor: ChatActor): Promise<void> {
    const conversation = await this.requireVisible(conversationId, actor)

    if (!actor.roles.includes(SYSTEM_ROLE_ADMIN)) {
      throw new ForbiddenError('A conversation is erased by an admin')
    }
    if (conversation.type === ChatConversationType.General) {
      throw new UnprocessableEntityError('The general channel cannot be erased')
    }

    const messageIds = await this.repo.listMessageIds(conversationId)
    // Before the messages go: those rows carry no foreign key and would survive as bell entries
    // pointing into a room that is not there.
    await this.notifications.dropForChatMessages(messageIds)
    // ⚠ And before the ROW goes: the attachment rows follow it by cascade, and after that nothing
    // names the objects. Same order as the intake's signed-order erase, for the same reason.
    await this.attachments.eraseStoredFiles(conversationId)
    await this.repo.deleteConversation(conversationId)

    await this.audit.log({
      entityType: 'chat_conversation',
      entityId: conversationId,
      action: AuditAction.Delete,
      actorUserId: actor.id,
      // The only trace left. It says WHICH room and how much talk went with it.
      changes: {
        type: conversation.type,
        title: conversation.title,
        messagesErased: messageIds.length,
      },
    })
  }

  /**
   * Who a mention in this conversation may name.
   *
   * Behind the same door as everything else in the module (`INTERNAL_APP_PERMISSIONS`) and behind
   * the same 404 — asking who is in a room you cannot enter tells you the room exists. It exists
   * at all because no other endpoint in the app may be called by an account that only has chat:
   * `users`, `employees`, `roles` and `audit` each demand a permission outside that set, so a
   * serviser could pass the chat door and reach no name anywhere.
   */
  async listPeople(conversationId: string, actor: ChatActor): Promise<ChatPeopleResponse> {
    const conversation = await this.requireVisible(conversationId, actor)
    const rows = await this.repo.listPeopleFor(conversation)

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        initials: getInitials(row.name, row.email),
      })),
    }
  }

  /**
   * The message AND the room it is in, in one place: a message id alone says nothing about who may
   * touch it, so every action goes through the same visible set the reads use. 404 either way — a
   * message in a conversation he cannot open is, for him, not there.
   */
  private async requireVisibleMessage(
    messageId: string,
    actor: ChatActor,
  ): Promise<{ message: ChatMessage; conversation: ChatConversationListItem }> {
    const message = await this.repo.findMessageById(messageId)
    if (message === null) {
      throw new NotFoundError('Chat message', messageId)
    }
    // The room comes back with the message: an edit may add a mention, and ringing it needs to
    // know who can see the room — asking a second time would be a second answer to one question.
    const conversation = await this.requireVisible(message.conversationId, actor)

    return { message, conversation }
  }

  /**
   * 404, never 403: a conversation he may not read is one that, for him, is not there.
   *
   * It hands back the conversation it had to fetch anyway — the mention picker needs to know
   * WHICH room it is answering for, and fetching it a second time to learn that would be two
   * reads and two chances to disagree.
   */
  private async requireVisible(
    conversationId: string,
    actor: ChatActor,
  ): Promise<ChatConversationListItem> {
    const conversation = await this.repo.findVisibleConversation(conversationId, scopeFor(actor))
    if (conversation === null) {
      throw new NotFoundError('Chat conversation', conversationId)
    }

    return conversation
  }
}
