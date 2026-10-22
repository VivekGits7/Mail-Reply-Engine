import { MotionConfig } from 'motion/react';
import Router from '@/components/Router';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCrossTabAuthSync } from '@/hooks/useCrossTabAuthSync';

export default function App() {
  useCrossTabAuthSync();

  return (
    <ThemeProvider storageKey="hr-desk-theme">
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          <Router />
        </TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
      </MotionConfig>
    </ThemeProvider>
  );
}
