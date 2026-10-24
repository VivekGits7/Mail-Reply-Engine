import { ClipboardCheck, DoorOpen, Search, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { selectIsAdmin, selectUser } from '@/redux/authSlice';
import { useAppSelector } from '@/redux/hooks';
import { JoinerFormDialog } from '@/components/joiners/JoinerFormDialog';
import { Orb } from '@/components/visual/Orb';
import { openQuickSearch } from '@/utils/quickSearch';

const CHIP =
  'pill inline-flex h-9 items-center gap-2 px-3.5 text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

export function WelcomePanel() {
  const user = useAppSelector(selectUser);
  const isAdmin = useAppSelector(selectIsAdmin);
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <section
      aria-labelledby="welcome-title"
      className="relative flex min-w-0 flex-col items-center overflow-hidden panel p-5 text-center sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <Orb className="mt-4" />
      <h2
        id="welcome-title"
        className="mt-8 text-2xl leading-tight font-normal tracking-[-0.03em] text-balance"
      >
        Welcome, {firstName}
        <span className="block text-muted-foreground">What needs you today?</span>
      </h2>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {isAdmin && (
          <JoinerFormDialog
            trigger={
              <button type="button" className={CHIP}>
                <UserPlus className="size-4 text-muted-foreground" aria-hidden="true" />
                Add a joiner
              </button>
            }
          />
        )}
        <Link to="/exits" className={CHIP}>
          <DoorOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          Exits
        </Link>
        <Link to="/approvals" className={CHIP}>
          <ClipboardCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          Review drafts
        </Link>
      </div>
      <button
        type="button"
        onClick={openQuickSearch}
        className="mt-auto flex w-full items-center gap-3 rounded-3xl bg-card px-4 pt-4 pb-10 text-left text-sm text-muted-foreground shadow-[var(--pill-shadow)] ring-1 ring-border transition-shadow hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:mt-8"
      >
        <Search className="size-4" aria-hidden="true" />
        Find a joiner or exit by name
        <kbd className="ml-auto rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">⌘K</kbd>
      </button>
    </section>
  );
}
