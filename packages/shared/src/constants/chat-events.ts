export const ChatEventType = {
  MessageCreated: 'chat_message_created',
} as const

export type ChatEventType = (typeof ChatEventType)[keyof typeof ChatEventType]

/**
 * Signal only: two ids, and never a word of what was said. The client invalidates the
 * conversation's queries and asks the server, which is the only thing that knows who may read
 * what. Putting the body here would push chat text at every listener on the channel.
 */
export interface ChatMessageEventPayload {
  conversationId: string
  messageId: string
}
