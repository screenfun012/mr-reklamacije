import { schema } from '@mr/db'

// A chat file is a row in the shared attachments table, hung on the message by chat_message_id.
export const attachments = schema.attachments
export const chatConversations = schema.chatConversations
export const chatMembers = schema.chatMembers
export const chatMessages = schema.chatMessages
export const chatMutes = schema.chatMutes
export const chatPins = schema.chatPins
export const chatReads = schema.chatReads
export const chatReactions = schema.chatReactions
export const emotiveClaims = schema.emotiveClaims
export const domaceClaims = schema.domaceClaims
export const customers = schema.customers
export const users = schema.users
// Read only to answer "who may see this conversation" — the mention picker's whole question.
export const userRoles = schema.userRoles
export const roles = schema.roles
export const rolePermissions = schema.rolePermissions
