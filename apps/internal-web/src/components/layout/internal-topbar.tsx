import { UserMenu } from './user-menu'

export interface InternalTopbarProps {
  userEmail: string
  userName: string
  onLogout: () => void
}

export function InternalTopbar({ userEmail, userName, onLogout }: InternalTopbarProps) {
  return (
    <div className="flex items-center gap-3">
      <UserMenu userName={userName} userEmail={userEmail} onLogout={onLogout} />
    </div>
  )
}
