import { useState, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  FlaskConical,
  Paperclip,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/common/QueryState';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/visual/Avatar';
import { cn } from '@/utils/cn';
import { CASE_TYPE_LABELS, EMAIL_CATEGORY_LABELS } from '@/utils/labels';
import { formatBytes, formatDateTime, humanize } from '@/utils/utility';
import type { CaseEmailsResponse, EmailThread, ThreadMessage } from '@/types';
import { casesApi } from './Casesapi';
import { OpenFileButton } from './OpenFileButton';

const LONG_BODY_CHARS = 700;
const AGENT_NAME = 'HR Desk agent';

const TAG_TONES = {
  muted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  sun: 'bg-sun/30 text-sun-foreground dark:text-sun',
  danger: 'bg-destructive/10 text-destructive',
} as const;

function Tag({
  children,
  icon: Icon,
  tone = 'muted',
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TAG_TONES;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium',
        TAG_TONES[tone],
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

function MessageCard({ message }: { message: ThreadMessage }) {
  const [full, setFull] = useState(false);
  const outbound = message.direction === 'outbound';
  const name = outbound ? AGENT_NAME : message.from_name || message.from_email || 'Unknown sender';
  const body = message.body?.trim() || 'This email has no text.';
  const long = body.length > LONG_BODY_CHARS;

  return (
    <li
      className={cn(
        'rounded-2xl border p-4',
        outbound ? 'border-primary/15 bg-primary/[0.04]' : 'border-border bg-card',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            {message.from_email && (
              <p className="truncate text-xs text-muted-foreground">{message.from_email}</p>
            )}
          </div>
        </div>
        <time dateTime={message.at} className="text-xs text-muted-foreground tabular-nums">
          {formatDateTime(message.at)}
        </time>
      </div>

      <dl className="mt-3 space-y-0.5 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">To</dt>
          <dd className="min-w-0 break-all">{message.to.join(', ') || 'No recipient'}</dd>
        </div>
        {message.cc.length > 0 && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Cc</dt>
            <dd className="min-w-0 break-all">{message.cc.join(', ')}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Tag icon={outbound ? ArrowUpRight : ArrowDownLeft} tone={outbound ? 'primary' : 'muted'}>
          {outbound ? (message.is_automatic ? 'Sent by the agent' : 'Sent after HR approval') : 'Received'}
        </Tag>
        {message.category && (
          <Tag>{EMAIL_CATEGORY_LABELS[message.category] ?? humanize(message.category)}</Tag>
        )}
        {message.case_type && <Tag>{CASE_TYPE_LABELS[message.case_type] ?? humanize(message.case_type)}</Tag>}
        {message.is_dry_run && (
          <Tag icon={FlaskConical} tone="sun">
            Dry run, delivered to the test inbox
          </Tag>
        )}
        {message.status === 'failed' && (
          <Tag icon={TriangleAlert} tone="danger">
            Not delivered
          </Tag>
        )}
      </div>

      {message.subject && <p className="mt-3 text-sm font-medium">{message.subject}</p>}
      <p className={cn('mt-1 text-sm break-words whitespace-pre-wrap', long && !full && 'line-clamp-10')}>
        {body}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setFull((value) => !value)}
          className="mt-1 text-xs font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {full ? 'Show less' : 'Show full email'}
        </button>
      )}

      {message.attachments.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attachments">
          {message.attachments.map((file) => (
            <li
              key={file.attachment_id}
              className="flex min-w-0 items-center gap-2 rounded-xl border bg-background py-1 pr-1 pl-3 text-xs"
            >
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="max-w-48 truncate">{file.file_name}</span>
              <span className="text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
              <OpenFileButton getUrl={() => casesApi.attachmentUrl(file.attachment_id)} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ThreadCard({
  thread,
  index,
  open,
  onToggle,
}: {
  thread: EmailThread;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const sent = thread.messages.filter((message) => message.direction === 'outbound').length;
  const received = thread.message_count - sent;
  const panelId = `email-thread-${index}`;

  return (
    <li className="overflow-hidden panel">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{thread.subject || 'No subject'}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {thread.message_count} {thread.message_count === 1 ? 'email' : 'emails'} · {sent} sent, {received}{' '}
            received · last {formatDateTime(thread.last_at)}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ol
          id={panelId}
          className="flex flex-col gap-3 border-t p-4 sm:px-5"
          aria-label={thread.subject ?? 'Email thread'}
        >
          {thread.messages.map((message) => (
            <MessageCard key={message.email_id} message={message} />
          ))}
        </ol>
      )}
    </li>
  );
}

export function EmailsPanel({ query }: { query: UseQueryResult<CaseEmailsResponse> }) {
  const [opened, setOpened] = useState<Set<string> | null>(null);

  if (query.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-3xl" />
        <Skeleton className="h-16 w-full rounded-3xl" />
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const threads = query.data.data;
  if (!threads.length) {
    return (
      <EmptyState
        title="No emails with this person yet"
        description="Emails the agent sends and the replies that come back show up here as threads."
      />
    );
  }
  const open = opened ?? new Set([threads[0].thread_id]);
  const toggle = (threadId: string) => {
    const next = new Set(open);
    if (next.has(threadId)) next.delete(threadId);
    else next.add(threadId);
    setOpened(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Every email with this person across their cases, newest thread first. Complaints never show here.
      </p>
      <ul className="flex flex-col gap-3" aria-label="Email threads">
        {threads.map((thread, index) => (
          <ThreadCard
            key={thread.thread_id}
            thread={thread}
            index={index}
            open={open.has(thread.thread_id)}
            onToggle={() => toggle(thread.thread_id)}
          />
        ))}
      </ul>
    </div>
  );
}
