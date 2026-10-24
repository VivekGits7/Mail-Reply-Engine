import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';

export function ErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[50vh] max-w-md flex-col items-start justify-center gap-3 px-4"
    >
      <h1 className="text-[1.9rem] leading-tight font-normal tracking-[-0.035em]">This page hit a problem</h1>
      <p className="text-sm text-muted-foreground">Try again. If it keeps happening, reload the page.</p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}
