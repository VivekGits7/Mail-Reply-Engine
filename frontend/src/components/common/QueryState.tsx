import type { ReactNode } from 'react';
import { CircleAlert, Inbox, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/utils/apiError';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 panel p-6 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <CircleAlert className="size-5" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-sm text-destructive">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center gap-2 overflow-hidden panel px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:14px_14px]"
      />
      <span className="relative mb-2 flex size-14 items-center justify-center pill rounded-2xl text-muted-foreground">
        <Inbox className="size-6" aria-hidden="true" />
      </span>
      <p className="relative text-base font-medium">{title}</p>
      {description && (
        <p className="relative max-w-md text-sm text-pretty text-muted-foreground">{description}</p>
      )}
      {action && <div className="relative mt-2">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 panel p-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-full rounded-xl" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function BlockSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-56 w-full rounded-[1.75rem]" />
    </div>
  );
}
