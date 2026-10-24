import { Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocation, useOutlet } from 'react-router';
import { BlockSkeleton } from '@/components/common/QueryState';
import { EASE_FLUID } from '@/utils/animations';

function FrozenOutlet() {
  const outlet = useOutlet();
  // Keep the outlet captured at mount so the exiting page renders its own content, not the next route.
  const [frozen] = useState(outlet);
  return frozen;
}

export function AnimatedOutlet() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE_FLUID } }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.12, ease: 'easeIn' } }}
        className="origin-top"
      >
        <Suspense fallback={<BlockSkeleton />}>
          <FrozenOutlet />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
