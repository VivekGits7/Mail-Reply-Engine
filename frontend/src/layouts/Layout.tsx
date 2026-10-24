import { useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router';
import { AnimatedOutlet } from '@/components/animated/AnimatedOutlet';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { preloadPages, whenIdle } from '@/components/pages';
import { Header } from './header/Header';
import { SendingBanner } from './header/SendingBanner';
import { Sidebar } from './sidebar/Sidebar';

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
      <div className="mx-auto flex w-full max-w-[1600px] gap-4 p-2 sm:p-3 lg:p-4">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Header />
          <SendingBanner />
          <main id="main-content" className="w-full flex-1 px-1 pt-2 pb-12 sm:px-2">
            <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[location.pathname]}>
              <AnimatedOutlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
