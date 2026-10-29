import { useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router';
import { AnimatedOutlet } from '@/components/animated/AnimatedOutlet';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { preloadPages, whenIdle } from '@/components/pages';
import { Header } from './header/Header';
import { DesktopSidebar } from './sidebar/DesktopSidebar';

export default function Layout() {
  const location = useLocation();

  useEffect(() => {
    // Fetch every page bundle once the shell is idle so switching tabs never waits on the network.
    whenIdle(() => preloadPages());
  }, []);

  return (
    <div className="min-h-svh overflow-x-clip text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-[96rem] gap-5 p-2 sm:p-3 lg:p-4">
        <DesktopSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Header />
          <main id="main-content" className="w-full max-w-7xl flex-1 px-3 pt-2 pb-12 sm:px-4 lg:px-6">
            <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[location.pathname]}>
              <AnimatedOutlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
