/**
 * Query keys for the chat. Only the keys live here for now — the fetchers land with the screen.
 *
 * They exist this early because the SSE handler needs something to invalidate the moment the
 * server starts publishing `chat_message_created`, and a signal nobody acts on is the quiet way
 * a realtime feature ends up not being realtime.
 */
export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
}
