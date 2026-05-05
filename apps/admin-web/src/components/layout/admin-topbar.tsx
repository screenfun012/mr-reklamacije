import { UserMenu } from './user-menu';

export interface AdminTopbarProps {
  userEmail: string;
  userName: string;
  onLogout: () => void;
}

/**
 * Admin top bar contents — user menu on the right.
 * LanguageSwitcher, notifications, and breadcrumbs will be added
 * in 9.1c.2 and later.
 */
export function AdminTopbar({ userEmail, userName, onLogout }: AdminTopbarProps) {
  return (
    <div className="flex items-center gap-3">
      <UserMenu
        userName={userName}
        userEmail={userEmail}
        onLogout={onLogout}
      />
    </div>
  );
}
