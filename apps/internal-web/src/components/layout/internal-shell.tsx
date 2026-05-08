import { AppShell } from '@mr/ui';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { authClient } from '~/lib/auth-client';

import { InternalSidebar } from './internal-sidebar';
import { InternalTopbar } from './internal-topbar';

export interface InternalShellProps {
  children: ReactNode;
}

/**
 * Internal app shell. Composes the @mr/ui AppShell with sidebar and topbar
 * for the employee-facing frontend (operators / viewers via Phase 1.0 RBAC).
 */
export function InternalShell({ children }: InternalShellProps) {
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
      sidebar={<InternalSidebar />}
      topbar={
        <InternalTopbar
          userEmail={userEmail}
          userName={userName}
          onLogout={handleLogout}
        />
      }
    >
      {children}
    </AppShell>
  );
}
