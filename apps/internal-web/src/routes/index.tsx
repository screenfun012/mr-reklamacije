import { createFileRoute, redirect } from '@tanstack/react-router';

import { m } from '@mr/i18n';

import { InternalShell } from '~/components/layout/internal-shell';
import { authClient } from '~/lib/auth-client';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    // TODO(phase-1.0): Add role check — require 'operator' or 'admin' role
    // See docs/12-roadmap.md Phase 1.0 — Permissions
  },
  component: HomeComponent,
});

function HomeComponent() {
  const { data: session } = authClient.useSession();
  const userName = session?.user?.name ?? session?.user?.email ?? '';

  return (
    <InternalShell>
      <div>
        <h1 className="text-3xl font-bold mb-2">Dobrodošao, {userName}</h1>
        <p className="text-muted-foreground">
          {m.nav_pocetna()} — Coming soon — Phase 1
        </p>
      </div>
    </InternalShell>
  );
}
