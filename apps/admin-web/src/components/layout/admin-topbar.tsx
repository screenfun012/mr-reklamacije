export interface AdminTopbarProps {
  userEmail: string;
  userName: string;
}

/**
 * Admin top bar contents — user identity on the right.
 * LanguageSwitcher, notifications, and breadcrumbs will be added
 * in 9.1c.2 and later.
 */
export function AdminTopbar({ userEmail, userName }: AdminTopbarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-sm font-medium">{userName}</div>
        <div className="text-xs text-muted-foreground">{userEmail}</div>
      </div>
    </div>
  );
}
