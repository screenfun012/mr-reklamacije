export interface UserPasswordPort {
  setPassword(userId: string, newPassword: string): Promise<void>
}
