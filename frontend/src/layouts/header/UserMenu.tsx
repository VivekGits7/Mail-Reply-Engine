import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, LogOut } from 'lucide-react';
import { selectUser, updateUser } from '@/redux/authSlice';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { authApi, authKeys } from '@/components/auth/Authapi';
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
import { MyPhotoDialog } from './MyPhotoDialog';

// Photo links last an hour, so the profile is refreshed well before they run out.
const PROFILE_REFRESH_MS = 30 * 60 * 1000;

export function UserMenu() {
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();
  const [photoOpen, setPhotoOpen] = useState(false);
  const profile = useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.me,
    refetchInterval: PROFILE_REFRESH_MS,
    staleTime: PROFILE_REFRESH_MS,
  });

  useEffect(() => {
    if (profile.data) dispatch(updateUser(profile.data));
  }, [profile.data, dispatch]);

  async function signOut() {
    try {
      await authApi.logout();
    } catch {
      // The token is cleared locally either way.
    }
    logout();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full transition-transform duration-200 hover:scale-[1.04] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Account menu"
          >
            <Avatar name={user?.name ?? 'HR'} src={user?.photo_url} size="md" className="size-11 ring-card" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 p-1.5">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">{humanize(user?.role)}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPhotoOpen(true)}>
            <Camera aria-hidden="true" /> Change photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={signOut}>
            <LogOut aria-hidden="true" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {user && <MyPhotoDialog user={user} open={photoOpen} onOpenChange={setPhotoOpen} />}
    </>
  );
}
