import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export default function NoMatch() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-start justify-center gap-3 px-4">
      <p className="text-sm font-medium text-muted-foreground tabular-nums">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that page</h1>
      <p className="text-sm text-muted-foreground">The link may be old, or the case was moved.</p>
      <Button asChild>
        <Link to="/">Go to overview</Link>
      </Button>
    </div>
  );
}
