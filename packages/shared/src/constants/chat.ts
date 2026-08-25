import { ALLOWED_IMAGE_MIME_TYPES } from './limits.js'

/** Which of the three kinds a conversation is. */
export const ChatConversationType = {
  /** The one channel everyone internal is in. It cannot be created, left or deleted. */
  General: 'general',
  /** A channel the team makes for a topic — membership is explicit. */
  Channel: 'channel',
  /** One thread per claim, reachable from the claim's detail and from an MR number in any text. */
  Claim: 'claim',
} as const

export type ChatConversationType = (typeof ChatConversationType)[keyof typeof ChatConversationType]

export const chatConversationTypeValues = [
  ChatConversationType.General,
  ChatConversationType.Channel,
  ChatConversationType.Claim,
] as const

/**
 * What the shop's own events write into a thread. They are NEVER counted as unread and never
 * raise a popup — they are a record, not somebody talking.
 */
export const ChatSystemKind = {
  ThreadCreated: 'thread_created',
  OutcomeChanged: 'outcome_changed',
  AttachmentAdded: 'attachment_added',
  PublishedToClient: 'published_to_client',
  CategoryChanged: 'category_changed',
  ChannelCreated: 'channel_created',
} as const

export type ChatSystemKind = (typeof ChatSystemKind)[keyof typeof ChatSystemKind]

export const chatSystemKindValues = [
  ChatSystemKind.ThreadCreated,
  ChatSystemKind.OutcomeChanged,
  ChatSystemKind.AttachmentAdded,
  ChatSystemKind.PublishedToClient,
  ChatSystemKind.CategoryChanged,
  ChatSystemKind.ChannelCreated,
] as const

/**
 * What a chat message may carry: photos and PDF, nothing else (Nikola, 2026-08-24).
 *
 * ⚠ This list is narrower than the shared pipeline's, and it has to be. `detectAttachmentMimeType`
 * happily recognises mp4, mov, docx and xlsx, so without a whitelist of its own "photos and PDF"
 * would be a promise made only by the browser's `accept` attribute — a hint, not a rule.
 */
export const ALLOWED_CHAT_ATTACHMENT_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  'application/pdf',
] as const

export type AllowedChatAttachmentMimeType = (typeof ALLOWED_CHAT_ATTACHMENT_MIME_TYPES)[number]

export function isAllowedChatAttachmentMimeType(
  mimeType: string,
): mimeType is AllowedChatAttachmentMimeType {
  return (ALLOWED_CHAT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Five files per message, and no quota per room (Nikola, 2026-08-24).
 *
 * A per-room cap would answer "this room is full" — a sentence nobody in the hall can act on. The
 * per-file 25 MB and the browser-side downscale to 2048px are what actually bound the disk.
 */
export const CHAT_MAX_FILES_PER_MESSAGE = 5

/** A message is a message, not a document — the composer is one line that grows. */
export const CHAT_MESSAGE_MAX_LENGTH = 4000

/** One page of history. Keyset by `seq`, never an offset — an infinite scroll has no page number. */
export const CHAT_MESSAGES_PAGE_SIZE = 50

/** The channel-management table is deliberately capped at fifty rows per page. */
export const CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE = 50

/**
 * ⚠ The reason no message is lost, and the one number here that must never be "optimised" away.
 *
 * `seq` is handed out at INSERT and becomes visible at COMMIT, so a reader can see 42 while 41 is
 * still being written. A client that remembered 42 and asked for `> 42` would lose 41 forever.
 * So it asks for `> maxSeen - CHAT_RECOVERY_OVERLAP` and drops the ids it already holds — the
 * duplicates cost twenty rows, the alternative costs a message nobody can ever see again.
 */
export const CHAT_RECOVERY_OVERLAP = 20

/**
 * How long a message stays editable. Not forever: the messages are evidence for a claim
 * (handoff §8.7), and a correction hours later is a different thing from a typo fixed at once.
 */
export const CHAT_EDIT_WINDOW_MS = 15 * 60_000

/** Pins are a shortlist, not a second inbox. */
export const CHAT_PINS_MAX = 20

/**
 * How many files the room's shelf shows. Nine, because the prototype draws a 3×3 grid
 * (`cet-prototip.dc.html` L174) and the last square carries „+N" for the rest.
 */
export const CHAT_CONTEXT_ATTACHMENTS_SHOWN = 9

/** Read receipts are throttled to this — one write per open, not one per rendered frame. */
export const CHAT_READ_THROTTLE_MS = 5_000

/** How much of a message the bell repeats. Enough to recognise it, not enough to replace opening it. */
export const CHAT_MENTION_EXCERPT_MAX = 140

/** How much of a quoted message the block repeats. One line, not the message again. */
export const CHAT_QUOTE_EXCERPT_MAX = 120

/**
 * What a person wants on their phone. Nikola's switch, 2026-08-23: „sve poruke · samo pomeni ·
 * bez teksta".
 *
 * ⚠ `NoText` is not "quieter" — it is the same frequency with the words held back. The phone on a
 * workbench says a room has something new; what it says is only readable by unlocking it. That is
 * the whole point of the position, and the reason it is not simply `Mentions` with a different
 * label.
 *
 * ⚠ There is no `Off`. Turning push off is removing the subscription, and a switch that pretends
 * otherwise leaves a row the server keeps paying a request for on every message.
 */
export const PushSubscriptionMode = {
  All: 'all',
  Mentions: 'mentions',
  NoText: 'no_text',
} as const

export type PushSubscriptionMode = (typeof PushSubscriptionMode)[keyof typeof PushSubscriptionMode]

export const pushSubscriptionModeValues = [
  PushSubscriptionMode.All,
  PushSubscriptionMode.Mentions,
  PushSubscriptionMode.NoText,
] as const
