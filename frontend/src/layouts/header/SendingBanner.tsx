import { useQuery } from '@tanstack/react-query';
import { FlaskConical, MailWarning, OctagonPause } from 'lucide-react';
import { Link } from 'react-router';
import { statusQuery } from '@/components/admin/Adminapi';
import { cn } from '@/utils/cn';
import { sendingSummary } from '@/utils/systemState';

const BANNERS = {
  stopped: {
    icon: OctagonPause,
    title: 'Sending is stopped.',
    detail: () => 'The agent still reads mail but sends nothing.',
    link: 'Open controls',
  },
  held: {
    icon: MailWarning,
    title: 'Every email is on hold.',
    detail: () => 'Dry run is on but no test inbox is set.',
    link: 'Set test inbox',
  },
  test: {
    icon: FlaskConical,
    title: 'Dry run is on.',
    detail: (inbox: string) => `Every email goes to ${inbox} instead of real people.`,
    link: 'Open controls',
  },
} as const;

export function SendingBanner() {
  const { data } = useQuery(statusQuery());
  if (!data) return null;
  const { mode } = sendingSummary(data);
  if (mode === 'live') return null;
  const banner = BANNERS[mode];
  const Icon = banner.icon;
  const danger = mode !== 'test';

  return (
    <div
      role="status"
      className={cn(
        'rounded-3xl border px-5 py-2.5 text-sm',
        danger
          ? 'border-destructive/20 bg-destructive/8 text-destructive'
          : 'border-warning/25 bg-sun/15 text-warning',
      )}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {banner.title}
      </span>{' '}
      <span className="break-words">{banner.detail(data.test_inbox)}</span>{' '}
      <Link to="/admin/controls" className="font-medium whitespace-nowrap underline underline-offset-3">
        {banner.link}
      </Link>
    </div>
  );
}
