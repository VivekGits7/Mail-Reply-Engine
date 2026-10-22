import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocation, useOutlet } from 'react-router';

function FrozenOutlet() {
  const outlet = useOutlet();
  // Keep the outlet captured at mount so the exiting page renders its own content, not the next route.
  const [frozen] = useState(outlet);
  return frozen;
}

export function AnimatedOutlet() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
      >
        <FrozenOutlet />
      </motion.div>
    </AnimatePresence>
  );
}
