import { LogOut } from 'lucide-react';
import { selectUser } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { authApi } from '@/components/auth/Authapi';
import { Avatar } from '@/components/visual/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout } from '@/utils/logout';
import { humanize } from '@/utils/utility';

export function UserMenu() {
  const user = useAppSelector(selectUser);

  async function signOut() {
    try {
      await authApi.logout();
    } catch {
      // The token is cleared locally either way.
    }
    logout();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full transition-transform duration-200 hover:scale-[1.04] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label="Account menu"
        >
          <Avatar name={user?.name ?? 'HR'} size="md" className="size-11 ring-card" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-1.5">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{humanize(user?.role)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
