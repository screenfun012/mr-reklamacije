export interface UserSessionsPort {
  revokeAllForUser(userId: string): Promise<void>
}
