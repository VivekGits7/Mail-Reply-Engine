import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

export function PageTitle({ title }: { title: string }) {
  return <title>{`${title} · HR Desk`}</title>;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <PageTitle title={title} />
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-[1.85rem] leading-[1.05] font-normal tracking-[-0.035em] text-balance sm:text-[2.6rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

interface SectionHeadingProps {
  title: string;
  to?: string;
  linkLabel?: string;
  actions?: ReactNode;
  id?: string;
  className?: string;
}

export function SectionHeading({
  title,
  to,
  linkLabel = 'View all',
  actions,
  id,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-3', className)}>
      <h2 id={id} className="text-xl font-normal tracking-[-0.02em]">
        {title}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {to && (
          <Link
            to={to}
            className="inline-flex h-9 items-center gap-1.5 pill px-3.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowUpRight className="size-4" aria-hidden="true" />
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
