import { useQuery } from '@tanstack/react-query';
import { OctagonPause, FlaskConical } from 'lucide-react';
import { Link } from 'react-router';
import { statusQuery } from '@/components/admin/Adminapi';

export function SendingBanner() {
  const { data } = useQuery(statusQuery());
  if (!data || (!data.kill_switch && !data.dry_run)) return null;

  return data.kill_switch ? (
    <div role="status" className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:px-6 lg:px-8">
      <span className="inline-flex items-center gap-2 font-medium">
        <OctagonPause className="size-4" aria-hidden="true" />
        Sending is paused.
      </span>{' '}
      The agent still reads mail but sends nothing.{' '}
      <Link to="/admin/controls" className="font-medium underline underline-offset-3">
        Open controls
      </Link>
    </div>
  ) : (
    <div role="status" className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning sm:px-6 lg:px-8">
      <span className="inline-flex items-center gap-2 font-medium">
        <FlaskConical className="size-4" aria-hidden="true" />
        Dry run is on.
      </span>{' '}
      Every email goes to {data.test_inbox || 'the test inbox'}.{' '}
      <Link to="/admin/controls" className="font-medium underline underline-offset-3">
        Open controls
      </Link>
    </div>
  );
}
