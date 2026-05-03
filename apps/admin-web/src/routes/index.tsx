import { m } from '@mr/i18n';
import { Button } from '@mr/ui';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { authClient } from '~/lib/auth-client';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // Running in the browser on every client navigation and on the SSR pass
    // too; Better-Auth's getSession() handles both environments by reading
    // the cookie from document.cookie or the inbound request context.
    const { data: session } = await authClient.getSession();
    if (session === null) {
      throw redirect({ to: '/login' });
    }
  },
  component: HomeComponent,
});

function HomeComponent(): React.ReactElement {
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await authClient.signOut();
    await navigate({ to: '/login' });
  };

  return (
    <main className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">MR Reklamacije Admin</h1>
      <p className="text-muted-foreground mb-8">
        9.1b skelet — ulogovan si. Sledi 9.1c (sidebar + dashboard).
      </p>
      <div className="flex gap-4 flex-wrap">
        <Button>{m.action_save()}</Button>
        <Button variant="destructive">{m.action_delete()}</Button>
        <Button variant="outline">{m.nav_dashboard()}</Button>
        <Button variant="secondary">{m.action_cancel()}</Button>
        <Button variant="ghost">{m.action_edit()}</Button>
      </div>

      <div className="mt-8">
        <Button
          variant="outline"
          onClick={() => {
            void handleLogout();
          }}
        >
          {m.auth_logout()}
        </Button>
      </div>
    </main>
  );
}
