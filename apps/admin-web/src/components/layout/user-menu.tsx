import { m } from '@mr/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@mr/ui';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';

import { useTheme, type Theme } from '~/lib/theme';

export interface UserMenuProps {
  userName: string;
  userEmail: string;
  onLogout: () => void;
}

function getInitials(name: string, email: string): string {
  const source = (name.trim().length > 0 ? name : email).trim();
  if (source.length === 0) {
    return '?';
  }
  const parts = source.split(/\s+/).filter((part) => part.length > 0);
  let initials: string;
  if (parts.length >= 2) {
    initials = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`;
  } else {
    initials = source.slice(0, 2);
  }
  return initials.toUpperCase();
}

export function UserMenu({ userName, userEmail, onLogout }: UserMenuProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const initials = getInitials(userName, userEmail);

  const handleThemeChange = (value: string): void => {
    setTheme(value as Theme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={m.user_menu_label()}
        className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {initials}
        </div>
        <div className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-medium">{userName}</span>
          <span className="text-xs text-muted-foreground">{userEmail}</span>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{userName}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {userEmail}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {resolvedTheme === 'dark' ? (
              <Moon aria-hidden="true" />
            ) : (
              <Sun aria-hidden="true" />
            )}
            <span>{m.theme_label()}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
                <DropdownMenuRadioItem value="system">
                  <Monitor aria-hidden="true" />
                  <span>{m.theme_system()}</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light">
                  <Sun aria-hidden="true" />
                  <span>{m.theme_light()}</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon aria-hidden="true" />
                  <span>{m.theme_dark()}</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onLogout}>
          <LogOut aria-hidden="true" />
          <span>{m.auth_logout()}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
