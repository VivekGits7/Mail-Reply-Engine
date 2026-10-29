import { useSearchParams } from 'react-router';

export const DEFAULT_PAGE_SIZE = 10;

export function useUrlState() {
  const [params, setParams] = useSearchParams();

  function get(key: string): string | undefined {
    return params.get(key) || undefined;
  }

  function set(updates: Record<string, string | undefined>, { keepPage = false } = {}) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        if (!keepPage && !('offset' in updates)) next.delete('offset');
        return next;
      },
      { replace: true },
    );
  }

  const offset = Math.max(0, Number(params.get('offset') ?? 0) || 0);
  const page = { limit: DEFAULT_PAGE_SIZE, offset };

  return { params, get, set, page };
}
