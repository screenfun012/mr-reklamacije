import { createFileRoute } from '@tanstack/react-router';

import { m } from '@mr/i18n';
import { Button } from '@mr/ui';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <main className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">MR Reklamacije Admin</h1>
      <p className="text-muted-foreground mb-8">
        9.1a skelet — testiranje Tailwind preset, @mr/ui i @mr/i18n
      </p>
      <div className="flex gap-4 flex-wrap">
        <Button>{m.action_save()}</Button>
        <Button variant="destructive">{m.action_delete()}</Button>
        <Button variant="outline">{m.nav_dashboard()}</Button>
        <Button variant="secondary">{m.action_cancel()}</Button>
        <Button variant="ghost">{m.action_edit()}</Button>
      </div>
    </main>
  );
}
