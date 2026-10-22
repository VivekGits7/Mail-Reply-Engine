import { ErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router';
import { AnimatedOutlet } from '@/components/animated/AnimatedOutlet';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { Header } from './header/Header';
import { SendingBanner } from './header/SendingBanner';
import { Sidebar } from './sidebar/Sidebar';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex min-h-svh overflow-x-clip bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <SendingBanner />
        <main id="main-content" className="w-full flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[location.pathname]}>
              <AnimatedOutlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
