import { AppShell } from '@mr/ui';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { authClient } from '~/lib/auth-client';

import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

export interface AdminShellProps {
  children: ReactNode;
}

/**
 * Admin app shell wrapper. Composes the @mr/ui AppShell with
 * admin-specific sidebar and topbar.
 *
 * Pulls user data from authClient.useSession() — during the first
 * SSR render the hook returns `data: undefined`, which manifests
 * as briefly blank user fields in the topbar until the browser
 * hydrates. Server-side session injection can replace this in
 * a later iteration if the flash becomes noticeable.
 *
 * Logout navigates to /login after signOut completes so the user
 * sees the login form instead of a stale shell.
 */
export function AdminShell({ children }: AdminShellProps) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const handleLogout = (): void => {
    void (async () => {
      await authClient.signOut();
      await navigate({ to: '/login' });
    })();
  };

  const userEmail = session?.user.email ?? '';
  const userName = session?.user.name ?? userEmail;

  return (
    <AppShell
      sidebar={<AdminSidebar onLogout={handleLogout} />}
      topbar={<AdminTopbar userEmail={userEmail} userName={userName} />}
    >
      {children}
    </AppShell>
  );
}
