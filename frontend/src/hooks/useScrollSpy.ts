import { useEffect } from 'react';
import { setActiveSection } from '@/redux/appSlice';
import { useAppDispatch } from '@/redux/hooks';

// Watches the dashboard's section elements and keeps the sidebar's active
// item in sync with whatever is actually in view, not just the last click.
export function useScrollSpy(ids: readonly string[]) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Earliest section in DOM order wins, so scrolling past several tall
        // sections still lands on the one nearest the top of the viewport.
        const current = ids.find((id) => visible.has(id));
        if (current) dispatch(setActiveSection(current));
      },
      // A thin band near the top of the viewport: a section "activates" once
      // its heading crosses it, well before it fills the screen.
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids, dispatch]);
}
