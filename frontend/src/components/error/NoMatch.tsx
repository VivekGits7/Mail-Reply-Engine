import { Link } from 'react-router';
import { Orb } from '@/components/visual/Orb';
import { Button } from '@/components/ui/button';

export default function NoMatch() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <Orb className="mb-4 size-24" />
      <p className="pill px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums">404</p>
      <h1 className="text-[1.9rem] leading-tight font-normal tracking-[-0.035em]">
        We couldn't find that page
      </h1>
      <p className="text-sm text-muted-foreground">The link may be old, or the case was moved.</p>
      <Button asChild size="lg" className="mt-2">
        <Link to="/">Go to overview</Link>
      </Button>
    </div>
  );
}
