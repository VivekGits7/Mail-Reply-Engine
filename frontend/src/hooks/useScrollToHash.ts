import { useEffect } from 'react';
import { useLocation } from 'react-router';

const MAX_ATTEMPTS = 20;
const RETRY_MS = 100;

// The dashboard is one long page made of lazy-loaded sections, so the target
// id may not exist in the DOM yet when a hash link (e.g. "/#joiners") lands —
// retry briefly instead of giving up on the first miss.
export function useScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cancelled = false;
    let attempts = 0;

    function tryScroll() {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      attempts += 1;
      if (attempts < MAX_ATTEMPTS) setTimeout(tryScroll, RETRY_MS);
    }

    tryScroll();
    return () => {
      cancelled = true;
    };
    // location.key changes on every navigation, even to the same hash, so re-run then too.
  }, [location.key, location.hash]);
}
